import requests
import zipfile
import io

API_URL = "http://localhost:8000"

def test_download(thread_id):
    print(f"Testing download for thread: {thread_id}")
    response = requests.get(f"{API_URL}/chat/{thread_id}/download")
    if response.status_code == 200:
        print("Download successful!")
        try:
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                print("Files in ZIP:", z.namelist())
                for name in z.namelist():
                    content = z.read(name).decode('utf-8')
                    print(f"--- {name} ---\n{content[:100]}...")
        except Exception as e:
            print(f"Failed to parse ZIP: {e}")
    else:
        print(f"Download failed with status: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    # We need a valid thread_id from the logs or previous runs
    # I'll try to find one from the backend logs
    import sys
    if len(sys.argv) > 1:
        test_download(sys.argv[1])
    else:
        print("Please provide a thread_id")
