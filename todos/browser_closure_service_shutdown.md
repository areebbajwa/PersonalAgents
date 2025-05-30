# Todo: Implement Service Shutdown on Manual Browser Closure

**Objective:** Modify the `browser-use` system so that if the user manually closes the browser window, the `browser_service.py` (FastAPI/Uvicorn service) detects this event and gracefully shuts itself down.

**Core Principle Adherence (dev-mode.mdc):**
*   **TDD:** This todo list forms the basis of our TDD approach. Tests will be conceptualized first.
*   **Aggressive Simplification:** The solution will directly address the requirement without unnecessary complexity. If existing code complicates this, it will be refactored or removed.
*   **No Fallbacks/Legacy:** This is a new behavior, no legacy considerations.
*   **Real-World Testing:** The final test will be manually closing the browser and observing the service termination.
*   **Foreground Only:** The service itself runs in the foreground when tested directly. CLI interactions are foreground.
*   **Clear Error Handling:** Errors during this process will be logged clearly.

---

## I. Investigation & Setup (If Needed)

1.  **[DONE] Clarify Requirement:** User manually closes browser -> `browser_service.py` stops.
2.  **[DONE] Review Existing Shutdown Mechanism:** Understand how `browser-use --stop-service` currently tells `browser_service.py` to stop. This might be reusable. (Assumed to be via HTTP endpoint leading to service.shutdown(), which handles signals correctly).
3.  **[DONE] Identify Playwright Browser Disconnect Event:** Confirm `browser.on("disconnected", callback)` is the correct Playwright event to listen for. (Confirmed and used).

## II. Implementation Steps

### A. Detecting Browser Disconnection

1.  **[DONE] Modify `PersistentBrowserSession` (or `PersistentBrowserWrapper` - decide most logical place):**
    *   **[DONE] Add an `async def handle_browser_disconnected(self):` method.**
        *   This method will be the callback when Playwright's browser object emits the "disconnected" event.
        *   It should log that the disconnection was detected.
    *   **[IN PROGRESS] In the `start` or `__aenter__` method (where the Playwright `Browser` object becomes available):** (Implemented in `start_with_disconnect_listener`)
        *   Attach the `handle_browser_disconnected` method as a listener to the `browser.on("disconnected", ...)` event.
        *   Ensure the listener is only added once. (Handled with `_disconnect_listener_attached` flag).
        *   **Note:** Ongoing issue: `self.browser` (or an equivalent reference to the Playwright Browser object) not reliably populated/connected immediately after `self.start()` in `PersistentBrowserSession`, which also impacts `manual_close`. Current attempt in `start_with_disconnect_listener` directly calls `self.start()` then checks `self.browser` and `self.browser_profile.browser`.
    *   **[DONE] Ensure proper detachment of the listener** if the session is closed programmatically by the service to avoid issues during normal shutdown. (e.g., in `manual_close` or `__aexit__`). (Attempted in `manual_close` and `handle_browser_disconnected`).

### B. Signaling the Service to Shut Down

*   **Chosen Approach:** Use `os.kill(os.getpid(), signal.SIGTERM)` from within `handle_browser_disconnected`. This will leverage the existing signal handling in `browser_service.py` for a graceful shutdown. This is the most direct and simple approach aligning with "Ruthless Simplification".

1.  **[DONE] Inside `handle_browser_disconnected`:**
    *   **[DONE] Add logging:** "Browser disconnected by user (or unexpectedly). Signaling service to shut down."
    *   **[DONE] Import `os` and `signal`.** (Implicitly done by usage).
    *   **[DONE] Call `os.kill(os.getpid(), signal.SIGTERM)` (or `signal.SIGINT`).** SIGTERM is generally preferred for graceful shutdown.
    *   **[DONE] Consider any immediate cleanup** needed in the wrapper/session itself before the service dies (e.g., setting `self.session = None` in the wrapper). (`_manually_closed = True` set, listener removal attempted).

### C. Modifying `browser_service.py` (If Necessary)

1.  **[DONE] Review `browser_service.py` signal handlers (`signal_handler` function):**
    *   Ensure it correctly triggers `await service.shutdown()`.
    *   The current implementation looks like it should work: `asyncio.create_task(service.shutdown())`. This is good as it allows the shutdown to proceed asynchronously without blocking the signal handler itself.
2.  **[IN PROGRESS] Review `service.shutdown()` in `browser_service.py`:**
    *   Ensure it calls `PersistentBrowserWrapper.stop()` which in turn calls `PersistentBrowserSession.manual_close()`. This chain is crucial.
    *   The `PersistentBrowserSession.manual_close()` should ideally remove the "disconnected" event listener before actually closing the browser to prevent the event from firing and trying to shut down an already shutting-down service. (This is implemented).
    *   **Note:** The call chain to `manual_close()` appears to execute, but `manual_close()` itself is not effectively closing the browser window. Needs detailed debugging within `manual_close`.

### D. Refinement and Cleanup (dev-mode.mdc)

1.  **[DONE] Remove any old/failed experimental code** related to browser health monitoring that is now obsolete (e.g., the `_monitor_browser_health`, `_is_browser_alive` methods from previous iterations if they are no longer serving this specific purpose). **The goal is service shutdown on manual browser close, not keeping the browser alive.** (Achieved by focusing on the single disconnect event mechanism).
2.  **[DONE] Ensure all new logging is clear and informative.**
3.  **[DONE] Verify no unnecessary complexity has been introduced.**

## III. Testing Plan

1.  **[FAILED] Test Case 1: Basic Service Operation**
    *   Run `browser-use "Navigate to google.com"`.
    *   Service starts, browser opens.
    *   Run `browser-use --stop-service`.
    *   **Expected:** Service stops, browser closes cleanly. (Verifies existing shutdown still works).
    *   **Actual:** Service CLI reports stopped, but browser window remains open.

2.  **[ ] Test Case 2: Manual Browser Closure -> Service Shutdown (Happy Path)**
    *   Run `browser-use "Navigate to google.com"`.
    *   Service starts, browser opens.
    *   **Manually close the browser window (Cmd+Q or click X).**
    *   **Expected:**
        *   Logs in `browser_service.py` (if run directly) or `persistent_browser_wrapper.py` should show the "disconnected" event being handled.
        *   `browser_service.py` should shut down gracefully within a few seconds.
        *   No orphaned browser or service processes.
        *   `curl -s http://localhost:8765/status` should fail (service is down).

3.  **[ ] Test Case 3: Service Resilience (Multiple Tasks then Manual Closure)**
    *   Run `browser-use "Navigate to google.com"`.
    *   Run `browser-use "Search for AI news"`.
    *   Browser remains open, tasks complete.
    *   **Manually close the browser window.**
    *   **Expected:** Same as Test Case 2 - service shuts down.

4.  **[ ] Test Case 4: Edge Case - Quick Manual Closure**
    *   Run `