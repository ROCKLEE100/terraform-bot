from typing import TypedDict, List, Optional, Dict, Any
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from dotenv import load_dotenv
import os
import uuid
import json
import re
import threading
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse, StreamingResponse
import httpx
import zipfile
import io

# ======================
# Load Environment
# ======================
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError("GROQ_API_KEY missing in .env")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SESSION_SECRET = os.getenv("SESSION_SECRET", "super-secret-session-key")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ======================
# Define State
# ======================
class GraphState(TypedDict):
    messages: List
    terraform_config: str
    retries: int
    approved: bool
    validate_result: str
    approve_result: str
    next_action: str
    missing_field: str         
    missing_question: str
    security_issues: str
    security_severity: str
    security_action: str
    extracted_provider: str
    extracted_region: str
    extracted_instance_type: str
    extracted_resource_type: str
                          


# ======================
# Initialize LLM (Groq)
def log_to_file(message: str):
    with open("backend.log", "a") as f:
        f.write(message + "\n")
        f.flush()

# ======================
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    groq_api_key=api_key
)

# ======================
# AGENT: Understand Request
# ======================
def understand_request(state: GraphState) -> GraphState:
    log_to_file(f"\n[understand_request] Processing {len(state['messages'])} messages.")
    try:
        # Use full history to extract structured data
        response = llm.invoke(
            [
                SystemMessage(
                    content="""
You are a helpful assistant that extracts structured cloud deployment information from a conversation.
Look at the ENTIRE conversation history provided below.
Extract the following fields into a JSON object:
- provider: (e.g., AWS, GCP, Azure)
- region: (e.g., us-east-1, us-central1)
- instance_type: (e.g., t2.micro, n1-standard-1)
- resource_type: (e.g., S3 bucket, VPC, EC2 instance)

IMPORTANT:
1. Only include values that have been EXPLICITLY mentioned by the user in any of their messages.
2. If a value is not mentioned yet, use an empty string "".
3. Return ONLY the JSON object. No other text.

Format:
{
  "provider": "...",
  "region": "...",
  "instance_type": "...",
  "resource_type": "..."
}
"""
                )
            ] + state["messages"]
        )
        log_to_file(f"[understand_request] LLM Response: {response.content}")
        data = parse_json_robustly(response.content)
        return {
            **state,
            "messages": state["messages"] + [response],
            "extracted_provider": data.get("provider", ""),
            "extracted_region": data.get("region", ""),
            "extracted_instance_type": data.get("instance_type", ""),
            "extracted_resource_type": data.get("resource_type", ""),
        }
    except Exception as e:
        log_to_file(f"[Error] understand_request failed: {e}")
        return {
            **state,
            "messages": state["messages"] + [AIMessage(content="{}")],
            "extracted_provider": "",
            "extracted_region": "",
            "extracted_instance_type": "",
            "extracted_resource_type": "",
        }

# ======================
# AGENT: Generate Terraform
# ======================
def generate_tf(state: GraphState) -> GraphState:
    try:
        content = state["messages"][-1].content
        response = llm.invoke([
            HumanMessage(
                content=f"""
Generate a professional multi-file Terraform setup for this request:
{content}

Return ONLY a JSON object mapping filenames to their content.
Include files like main.tf, variables.tf, outputs.tf, and any other necessary files (e.g., network.tf).

Format:
{{
  "main.tf": "...",
  "variables.tf": "...",
  "outputs.tf": "..."
}}

Return ONLY valid JSON.
"""
            )
        ])
        terraform = response.content
    except Exception as e:
        print(f"[Error] generate_tf failed: {e}")
        terraform = "{}"

    print("\n[generate_tf] Multi-file Terraform config generated.")
    return {
        **state,
        "terraform_config": terraform,
    }

# ======================
# AGENT: Validate Terraform
# ======================
def validate_tf(state: GraphState) -> GraphState:
    terraform = state.get("terraform_config", "")
    result = "NO"

    if terraform:
        try:
            resp = llm.invoke([
                HumanMessage(
                    content=f"""
Check if this multi-file Terraform setup is valid:

{terraform}

Return ONLY:
YES
NO
"""
                )
            ])
            result = resp.content.strip()
        except Exception as e:
            print(f"[Error] validate_tf failed: {e}")

    print(f"[validate_tf] result = {result}")

    return {
        **state,
        "validate_result": result
    }

# ======================
# AGENT: Check for Missing Information
# ======================
def missing_info_agent(state: GraphState) -> GraphState:
    try:
        provider = state.get("extracted_provider", "")
        region = state.get("extracted_region", "")
        instance_type = state.get("extracted_instance_type", "")
        resource_type = state.get("extracted_resource_type", "")
        
        log_to_file(f"[missing_info_agent] Extracted: provider='{provider}', region='{region}', instance_type='{instance_type}', resource_type='{resource_type}'")

        if not provider:
            return { **state, "missing_field": "provider", "missing_question": "Which cloud provider do you want? (AWS / GCP / Azure)" }

        if not region:
            return { **state, "missing_field": "region", "missing_question": f"I see you want to use {provider}. Which region should I deploy in?" }

        user_messages = " ".join([m.content for m in state["messages"] if isinstance(m, HumanMessage)])
        needs_instance = any(x in resource_type.upper() or x in user_messages.upper() for x in ["EC2", "RDS", "COMPUTE", "VM", "SERVER"])
        
        if needs_instance and not instance_type:
            return { **state, "missing_field": "instance_type", "missing_question": f"Which instance type do you want for your {provider} deployment?" }

        return { **state, "missing_field": "", "missing_question": "" }
    except Exception as e:
        log_to_file(f"[missing_info_agent] ERROR: {e}")
        return { **state, "missing_field": "unknown", "missing_question": "An error occurred while checking for missing info." }

def ask_user_info(state: GraphState) -> GraphState:
    """Node that appends the missing question to messages so the user sees it."""
    question = state.get("missing_question", "")
    print(f"[ask_user_info] Question: {question}")
    if question:
        return {
            **state,
            "messages": state["messages"] + [AIMessage(content=question)]
        }
    return state

def wait_for_input(state: GraphState) -> GraphState:
    """Dummy node to interrupt at, after the question has been added to messages."""
    return state

def parse_json_robustly(content: str):
    """Helper to parse JSON even if wrapped in markdown code blocks or has extra text."""
    if not content:
        return {}
    content = content.strip()
    # Try to find the first '{' and last '}'
    start = content.find('{')
    end = content.rfind('}')
    if start != -1 and end != -1:
        content = content[start:end+1]
    
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            return data
        return {"main.tf": str(data)}
    except Exception as e:
        # Try one more time with regex if simple slicing failed
        import re
        match = re.search(r"(\{.*\})", content, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                if isinstance(data, dict):
                    return data
            except:
                pass
        return {"main.tf": content}

def security_scan_agent(state: GraphState) -> GraphState:
    terraform = state.get("terraform_config", "")

    if not terraform or terraform == "{}":
        return { **state, "security_severity": "NONE", "security_issues": "" }

    try:
        resp = llm.invoke([
            HumanMessage(
                content=f"""
You are a cloud security expert.

Analyze the following multi-file Terraform setup for security risks.
Return JSON ONLY in this format:

{{
  "severity": "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "issues": [
      "...",
      "..."
  ]
}}

Terraform setup:
{terraform}
"""
            )
        ])
        result = parse_json_robustly(resp.content)
        print(f"[security_scan_agent] Parsed result: {result}")
    except Exception as e:
        print("[security_scan_agent] error:", e)
        result = {"severity": "LOW", "issues": [f"Security scan failed to parse: {str(e)}"]}

    return {
        **state,
        "security_severity": result.get("severity", "LOW"),
        "security_issues": "\n".join(result.get("issues", ["Scan failed"]))
    }

def security_review_agent(state: GraphState) -> GraphState:
    print("[Security Review Needed]")
    print("Security Issues Detected:\n", state["security_issues"])
    # Interrupt handled via API
    return state


# ======================
# AGENT: Human Approval
# ======================
def approve_tf(state: GraphState) -> GraphState:
    return state

# ======================
# AGENT: Revise Terraform
# ======================
def revise_tf(state: GraphState) -> GraphState:
    print(f"[revise_tf] Starting revision. Current retries: {state.get('retries', 0)}")
    try:
        response = llm.invoke([
            HumanMessage(
                content=f"""
You are a Terraform expert. The user has requested changes or a security scan has failed.

CURRENT CONFIGURATION:
{state["terraform_config"]}

ISSUES TO FIX:
Validation Result: {state["validate_result"]}
Security Issues: {state["security_issues"]}

TASK:
1. Revise the Terraform configuration to address ALL issues mentioned above.
2. If the security scan failed due to public access, ensure you set appropriate private access (e.g., acl = "private").
3. Return ONLY a valid JSON object mapping filenames to their updated content.
4. Do NOT include any markdown formatting or extra text outside the JSON.

Format:
{{
  "main.tf": "...",
  "variables.tf": "...",
  "outputs.tf": "..."
}}
"""
            )
        ])
        terraform = response.content
        # Verify it's valid JSON
        try:
            parse_json_robustly(terraform)
            print("[revise_tf] Successfully generated valid JSON revision.")
        except Exception as e:
            print(f"[revise_tf] Revision is not valid JSON: {e}")
            # If it's not valid JSON, we might want to keep the old one or try to fix it
            # For now, we'll just log it.
    except Exception as e:
        print(f"[Error] revise_tf failed: {e}")
        terraform = state["terraform_config"]

    return {
        **state,
        "terraform_config": terraform,
        "retries": state["retries"] + 1,
        "approve_result": "",
        "validate_result": "PENDING",
        "security_severity": "",
        "security_issues": "",
        "security_action": ""
    }


def supervisor_node(state: GraphState) -> GraphState:
    validate = state.get("validate_result", "")
    approve = state.get("approve_result", "")
    retries = state.get("retries", 0)
    terraform = state.get("terraform_config", "")
    missing = state.get("missing_field", "")
    
    print(f"\n[Supervisor] validate={validate}, approve={approve}, retries={retries}, missing={missing}")
    print(f"[Supervisor] missing_field='{missing}', next_action='{state.get('next_action')}'")

    # STEP 0: Missing Info?
    if missing:
        print("[Supervisor] Routing to ask_user")
        return { **state, "next_action": "ask_user" }

    # Too many retries
    if retries >= 5:
        print("[Supervisor] Too many retries → stopping.")
        return { **state, "next_action": "end" }

    # STEP 1: If no Terraform yet → generate it
    if not terraform:
        return { **state, "next_action": "generate" }

    # STEP 2: If validation never ran → run validate
    if validate in ("", "PENDING"):
        return { **state, "next_action": "validate" }

    # STEP 3: If validation failed → revise
    if validate == "NO":
        return { **state, "next_action": "revise" }

    # STEP 4: If validation succeeded but user hasn't approved yet
    if validate == "YES" and approve == "":
        # Run security scan first if not done
        if not state.get("security_severity"):
            return { **state, "next_action": "security_scan" }
        
        # If security severity HIGH and no decision yet -> review
        if state.get("security_severity") == "HIGH" and state.get("security_action", "") == "":
            return { **state, "next_action": "security_review" }
        
        # If user chooses "fix"
        if state.get("security_action") == "fix":
            return { **state, "next_action": "revise" }

        # Otherwise (LOW/NONE or user ignored HIGH) -> ask for approval
        return { **state, "next_action": "approve" }

    # STEP 5: User approved -> end
    if approve == "approved":
        return { **state, "next_action": "end" }

    # STEP 6: User requested revision -> revise
    if approve == "revise":
        return { **state, "next_action": "revise" }

    # Fallback
    return { **state, "next_action": "end" }


# ======================
# Build Multi-Agent Graph
# ======================
graph = StateGraph(GraphState)

# Add nodes
graph.add_node("understand_request", understand_request)
graph.add_node("supervisor", supervisor_node)
graph.add_node("missing_info", missing_info_agent)
graph.add_node("ask_user_info", ask_user_info)
graph.add_node("wait_for_input", wait_for_input)
graph.add_node("generate_tf", generate_tf)
graph.add_node("validate_tf", validate_tf)
graph.add_node("security_scan", security_scan_agent)
graph.add_node("security_review", security_review_agent)

graph.add_node("approve_tf", approve_tf)
graph.add_node("revise_tf", revise_tf)

# Entry
graph.add_edge(START, "understand_request")

# understand → missing_info (always check)
graph.add_edge("understand_request", "missing_info")

# missing_info → supervisor
graph.add_edge("missing_info", "supervisor")


# ask_user_info → wait_for_input
graph.add_edge("ask_user_info", "wait_for_input")

# wait_for_input → understand_request (loop back after answer)
graph.add_edge("wait_for_input", "understand_request")

# supervisor dynamic routing
graph.add_conditional_edges(
    "supervisor",
    lambda state: state["next_action"],
    {
        "ask_user": "ask_user_info",
        "generate": "generate_tf",
        "validate": "validate_tf",
        "security_scan": "security_scan",
        "security_review": "security_review",
        "revise": "revise_tf",
        "approve": "approve_tf",
        "end": END
    }
)

# each agent returns control to supervisor
graph.add_edge("generate_tf", "supervisor")
graph.add_edge("validate_tf", "supervisor")
graph.add_edge("security_scan", "supervisor")
graph.add_edge("security_review", "supervisor")
graph.add_edge("approve_tf", "supervisor")
graph.add_edge("revise_tf", "supervisor")

# ======================
# Compile Graph with Memory
# ======================
memory = MemorySaver()
graph_app = graph.compile(
    checkpointer=memory,
    interrupt_before=[
        "approve_tf",
        "wait_for_input",
        "security_review"
    ]
)



# ======================
# FastAPI App
# ======================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)

# ======================
# Auth Endpoints
# ======================
@app.get("/login")
async def login():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    
    redirect_uri = f"{BACKEND_URL}/auth/callback"
    scope = "openid email profile"
    url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={GOOGLE_CLIENT_ID}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
    return RedirectResponse(url)

@app.get("/auth/callback")
async def auth_callback(code: str, request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": f"{BACKEND_URL}/auth/callback",
        "grant_type": "authorization_code",
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(token_url, data=data)
        token_data = resp.json()
        
        if "access_token" not in token_data:
            return RedirectResponse(f"{FRONTEND_URL}?error=auth_failed")
            
        # Get user info
        user_info_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )
        user_info = user_info_resp.json()
        
    # Store in session
    request.session["user"] = user_info
    return RedirectResponse(FRONTEND_URL)

@app.get("/user/me")
async def get_me(request: Request):
    user = request.session.get("user")
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": user}

@app.get("/logout")
async def logout(request: Request):
    request.session.pop("user", None)
    return RedirectResponse("http://localhost:5173")

class ChatRequest(BaseModel):
    message: str

class ApproveRequest(BaseModel):
    approved: bool
    feedback: Optional[str] = None

@app.post("/chat")
async def start_chat(req: ChatRequest):
    import threading
    
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    initial_state = {
        "messages": [HumanMessage(content=req.message)],
        "terraform_config": "",
        "retries": 0,
        "approved": False,
        "validate_result": "",
        "approve_result": "",
        "next_action": "generate",
        "missing_field": "",
        "missing_question": "",
        "extracted_provider": "",
        "extracted_region": "",
        "extracted_instance_type": "",
        "extracted_resource_type": ""
    }
    
    # Run graph in background thread to avoid blocking
    def run_graph():
        try:
            for event in graph_app.stream(initial_state, config):
                pass
        except Exception as e:
            print(f"Error in graph execution: {e}")
    
    thread = threading.Thread(target=run_graph, daemon=True)
    thread.start()
        
    return {"thread_id": thread_id, "status": "started"}

@app.get("/chat/{thread_id}")
async def get_chat_status(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    state = graph_app.get_state(config)
    
    if not state.values:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    current_state = state.values
    next_steps = state.next
    
    formatted_messages = [{"role": "user" if isinstance(m, HumanMessage) else "assistant", "content": m.content} for m in state.values.get("messages", [])]
    
    # Try to parse terraform_config as JSON for the frontend
    raw_tf = state.values.get("terraform_config", "{}")
    terraform_files = parse_json_robustly(raw_tf)

    return {
        "messages": formatted_messages,
        "terraform_config": terraform_files,
        "next_action": state.values.get("next_action", "end"),
        "waiting_for_approval": state.values.get("next_action") == "approve",
        "waiting_for_missing_info": state.values.get("next_action") in ["ask_user", "wait_for_input"],
        "waiting_for_security_review": state.values.get("next_action") == "security_review",
        "security_issues": state.values.get("security_issues", ""),
        "security_severity": state.values.get("security_severity", "NONE"),
    }

@app.get("/chat/{thread_id}/download")
async def download_tf(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    state = graph_app.get_state(config)
    
    if not state.values:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    raw_tf = state.values.get("terraform_config", "{}")
    files = parse_json_robustly(raw_tf)
        
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for filename, content in files.items():
            zip_file.writestr(filename, content)
            
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename=terraform-{thread_id}.zip"}
    )

@app.post("/chat/{thread_id}/approve")
async def approve_chat(thread_id: str, req: ApproveRequest):
    import threading
    
    config = {"configurable": {"thread_id": thread_id}}
    state = graph_app.get_state(config)
    
    if not state.values:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    decision = "approved" if req.approved else "revise"
    
    # Update state
    graph_app.update_state(config, {"approve_result": decision})
    
    # Resume graph in background thread
    def resume_graph():
        try:
            for event in graph_app.stream(None, config):
                pass
        except Exception as e:
            print(f"Error in graph execution: {e}")
    
    thread = threading.Thread(target=resume_graph, daemon=True)
    thread.start()
        
    return {"status": "resumed", "decision": decision}

class MissingInfoAnswer(BaseModel):
    answer: str

@app.post("/chat/{thread_id}/missing_info")
async def answer_missing(thread_id: str, req: MissingInfoAnswer):
    import threading
    
    config = {"configurable": {"thread_id": thread_id}}
    state = graph_app.get_state(config)

    missing = state.values.get("missing_field")
    if not missing:
        raise HTTPException(400, "No missing information to answer.")

    # Add user's answer as new message
    new_msg = HumanMessage(content=req.answer)

    graph_app.update_state(config, {
        "messages": state.values["messages"] + [new_msg],
        "missing_field": "",
        "missing_question": ""
    })

    # Resume graph execution in background thread
    def resume_graph():
        try:
            for event in graph_app.stream(None, config):
                pass
        except Exception as e:
            print(f"Error in graph execution: {e}")
    
    thread = threading.Thread(target=resume_graph, daemon=True)
    thread.start()

    return {"status": "answered", "field": missing}

class SecurityDecision(BaseModel):
    action: str   # "fix" or "ignore"


@app.post("/chat/{thread_id}/security")
async def security_decision(thread_id: str, req: SecurityDecision):
    config = {"configurable": {"thread_id": thread_id}}

    graph_app.update_state(config, {
        "security_action": req.action
    })

    for event in graph_app.stream(None, config):
        pass

    return {"status": "security decision applied"}



# ======================
# Main Run
# ======================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
