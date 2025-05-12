import asyncio
import aiohttp
from browser_use import ActionResult # Assuming browser_use is installed

async def get_2fa_code() -> ActionResult:
    """Polls https://2fa.ngrok.app/get-2fa-code (max 60s) and returns the code."""
    url = "https://2fa.ngrok.app/get-2fa-code"
    print(f"\n[Custom Action get_2fa_code] Starting to poll {url} for 2FA code...")
    # Use a longer total timeout for the session, but keep individual request timeouts short
    session_timeout = aiohttp.ClientTimeout(total=65) 
    request_timeout = aiohttp.ClientTimeout(total=5) 
    async with aiohttp.ClientSession(timeout=session_timeout) as session:
        for attempt in range(30): # Poll for 30 * 2s = 60 seconds
            print(f"[Custom Action get_2fa_code] Polling attempt {attempt + 1}/30...")
            try:
                # Use a shorter timeout for each individual GET request
                async with session.get(url, timeout=request_timeout) as resp:
                    if resp.status == 200:
                        code = (await resp.text()).strip()
                        if code:
                            print(f"[Custom Action get_2fa_code] Retrieved: {code}")
                            # Ensure the returned value conforms to ActionResult if needed by the Controller
                            # Assuming ActionResult just needs the string content for now.
                            # If it needs specific fields, adjust this.
                            return ActionResult(extracted_content=code) 
                        else:
                            print("[Custom Action get_2fa_code] Received empty code, will retry...")
                    else:
                         print(f"[Custom Action get_2fa_code] Received status {resp.status}, will retry...")
                         
            except asyncio.TimeoutError:
                 print("[Custom Action get_2fa_code] Request timed out, will retry...")
            except aiohttp.ClientError as e:
                print(f"[Custom Action get_2fa_code] aiohttp error: {e}, will retry...")
            except Exception as e:
                 print(f"[Custom Action get_2fa_code] Unexpected error: {e}, will retry...")

            await asyncio.sleep(2) # Wait before the next poll

    print("[Custom Action get_2fa_code] Failed to retrieve 2FA code after 60 seconds.")
    # Raise an error or return a specific ActionResult indicating failure
    raise RuntimeError("Timed-out waiting for 2FA code from ngrok service") 