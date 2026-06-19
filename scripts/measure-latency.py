#!/usr/bin/env python3
"""Measure agent latency breakdown from the eve event stream.
Usage: measure-latency.py "<prompt>"  (reads CLERK_SECRET_KEY from .env.local)"""
import json, subprocess, sys, time, urllib.request, datetime as dt

PROMPT = sys.argv[1] if len(sys.argv) > 1 else "What are 3 budget cards to add to a Krenko, Mob Boss deck?"
BASE = "https://mtg-agent-sand.vercel.app/_eve_internal/eve/eve/v1"
API = "https://api.clerk.com/v1"

def sh(cmd): return subprocess.check_output(cmd, shell=True, text=True).strip()
SK = sh("grep '^CLERK_SECRET_KEY=' .env.local | cut -d= -f2-")

def clerk(path, body=None):
    args = ["curl","-s",f"{API}{path}","-H",f"Authorization: Bearer {SK}","-H","Content-Type: application/json"]
    if body is not None:
        args += ["-X","POST","-d",json.dumps(body)]
    out = subprocess.check_output(args, text=True)
    return json.loads(out)

# throwaway user + token
res = clerk("/users", {"email_address":["measure@example.com"],"password":"X9k2mPq7wLz4!vTn"})
u = res.get("id") or clerk("/users?email_address=measure@example.com")[0]["id"]
sid = clerk("/sessions", {"user_id": u})["id"]
jwt = clerk(f"/sessions/{sid}/tokens", {"expires_in_seconds": 900})["jwt"]

# fire the turn; stream with curl, timestamp every line locally (wall clock)
run = sh(f"""curl -s -X POST "{BASE}/session" -H 'content-type: application/json' -H "authorization: Bearer {jwt}" -d '{json.dumps({"message": PROMPT})}' | grep -oE 'wrun_[A-Z0-9]+' | head -1""")
t0 = time.time()
proc = subprocess.Popen(
    ["curl","-sN","--max-time","180", f"{BASE}/session/{run}/stream","-H",f"authorization: Bearer {jwt}"],
    stdout=subprocess.PIPE, text=True)

events = []        # (wall_offset, type, data)
first_text_t = None
last_text_t = None
out_tokens_text = 0
for line in proc.stdout:
    line = line.strip()
    if not line: continue
    try: e = json.loads(line)
    except: continue
    now = time.time() - t0
    t = e.get("type"); d = e.get("data", {})
    events.append((now, t, d))
    if t == "message.appended":
        if first_text_t is None: first_text_t = now
        last_text_t = now
    if t in ("turn.completed","turn.failed","session.failed"): break
proc.terminate()

total = events[-1][0] if events else 0
steps = sum(1 for _,t,_ in events if t == "step.started")
toolcalls = [a.get("toolName") or a.get("name") for _,t,d in events if t=="actions.requested" for a in (d.get("actions") or d.get("requests") or [])]
final_text = ""
for _,t,d in events:
    if t == "message.appended": final_text = d.get("messageSoFar", final_text)
# token usage from step.completed
in_tok = out_tok = 0
for _,t,d in events:
    if t == "step.completed":
        usg = d.get("usage") or {}
        in_tok += usg.get("inputTokens") or usg.get("promptTokens") or usg.get("input_tokens") or 0
        out_tok += usg.get("outputTokens") or usg.get("completionTokens") or usg.get("output_tokens") or 0

# tool execution time: sum(action.result - actions.requested)
tool_time = 0.0
pending = None
for now,t,_ in events:
    if t == "actions.requested": pending = now
    if t == "action.result" and pending is not None:
        tool_time += now - pending; pending = None

text_gen_time = (last_text_t - first_text_t) if (first_text_t and last_text_t) else 0
text_chars = len(final_text)

print(f"prompt: {PROMPT}")
print(f"─"*54)
print(f"TOTAL wall time      {total:6.1f}s")
print(f"tool round-trips     {len(toolcalls):6d}   {toolcalls}")
print(f"model steps          {steps:6d}")
print(f"time-to-first-token  {(first_text_t or 0):6.1f}s   (before any reply text appears)")
print(f"tool exec time       {tool_time:6.1f}s   (EDHREC/Scryfall network)")
print(f"final-text gen time  {text_gen_time:6.1f}s   for {text_chars} chars")
print(f"tokens   in={in_tok}  out={out_tok}")
if out_tok and total: print(f"effective output tps {out_tok/max(total,0.1):6.1f}  (out_tokens / total)")
print(f"─"*54)
print("reply preview:", final_text[:120].replace(chr(10)," "))
# cleanup
try: clerk_del = subprocess.run(["curl","-s","-X","DELETE",f"{API}/users/{u}","-H",f"Authorization: Bearer {SK}"], capture_output=True)
except: pass
