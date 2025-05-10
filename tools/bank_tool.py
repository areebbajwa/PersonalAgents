import os, json, subprocess
from langchain.tools import BaseTool

class BankEtransferTool(BaseTool):
    name: str = "get_recent_etransfers"
    description: str = "Return {name: float amount_paid_this_month}"

    def _run(self, month: str) -> dict:
        scraper = os.environ["BANK_SCRAPER_PATH"]
        try:
            proc = subprocess.run(
                ["node", scraper, "--month", month],
                capture_output=True, text=True, check=False,
                timeout=300
            )

            print(f"Bank scraper stdout:\n{proc.stdout}")
            print(f"Bank scraper stderr:\n{proc.stderr}")

            if proc.returncode != 0:
                print(f"Bank scraper exited with error code: {proc.returncode}")
                raise subprocess.CalledProcessError(proc.returncode, proc.args, output=proc.stdout, stderr=proc.stderr)

            return json.loads(proc.stdout)
        except subprocess.TimeoutExpired as e:
            print(f"Timeout running bank scraper: {scraper}")
            print(f"Stdout: {e.stdout}")
            print(f"Stderr: {e.stderr}")
            raise
        except json.JSONDecodeError as e:
            print(f"JSONDecodeError in bank_tool: {e}")
            print(f"Original stdout that failed to parse: {proc.stdout if 'proc' in locals() else 'proc not defined'}")
            raise
        except subprocess.CalledProcessError as e:
            print(f"Error running bank scraper: {scraper}")
            print(f"Return code: {e.returncode}")
            print(f"Stdout: {e.stdout}")
            print(f"Stderr: {e.stderr}")
            raise # Re-raise the exception after printing details 