#!/usr/bin/env python3
"""
Pipeline — TikTok Content Posting API test tool (official endpoints only).

Commands:
  python tiktok_test.py check                 # env/config check
  python tiktok_test.py connect-url           # print OAuth URL to open in browser
  python tiktok_test.py status                # connected accounts via Worker (masked)
  python tiktok_test.py creator-info          # POST /v2/post/publish/creator_info/query/
  python tiktok_test.py publish --file v.mp4 --title "caption" --privacy SELF_ONLY
                                            # DRY RUN by default; add --yes to really post

Real publishing happens ONLY with explicit --yes.
Tokens are obtained from the Worker (never from disk) or TIKTOK_ACCESS_TOKEN env var.
No client secret is used here — the Worker holds it.
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

OPEN_API = "https://open.tiktokapis.com"
CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB chunks


def load_dotenv(path=".env"):
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


def get_token(args):
    tok = os.environ.get("TIKTOK_ACCESS_TOKEN") or getattr(args, "token", None)
    if tok:
        return tok
    worker = os.environ.get("TIKTOK_WORKER_URL")
    api = os.environ.get("WORKER_API_TOKEN")
    if worker and api:
        req = urllib.request.Request(
            worker.rstrip("/") + "/api/access-token",
            headers={"Authorization": "Bearer " + api},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        if not data.get("ok"):
            sys.exit(f"Worker error: {data}")
        return data["access_token"]
    sys.exit(
        "No access token. Set TIKTOK_ACCESS_TOKEN, or TIKTOK_WORKER_URL + WORKER_API_TOKEN"
        " in environment or .env (see .env.example)."
    )


def api_post(path, token, body=None, raw_body=None, content_type="application/json; charset=UTF-8"):
    data = raw_body if raw_body is not None else (json.dumps(body).encode() if body is not None else b"")
    req = urllib.request.Request(OPEN_API + path, data=data, method="POST")
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def cmd_check(args):
    load_dotenv()
    checks = {
        "TIKTOK_WORKER_URL": bool(os.environ.get("TIKTOK_WORKER_URL")),
        "WORKER_API_TOKEN": bool(os.environ.get("WORKER_API_TOKEN")),
        "TIKTOK_ACCESS_TOKEN (direct fallback)": bool(os.environ.get("TIKTOK_ACCESS_TOKEN")),
    }
    for k, v in checks.items():
        print(f"  [{'x' if v else ' '}] {k}")
    if not any(checks.values()):
        print("Set at least Worker URL + API token in .env (copy .env.example).")
    else:
        print("OK — token source available.")


def cmd_connect_url(args):
    load_dotenv()
    worker = os.environ.get("TIKTOK_WORKER_URL")
    if not worker:
        sys.exit("Set TIKTOK_WORKER_URL in .env first.")
    url = worker.rstrip("/") + "/auth/tiktok"
    print("Open this URL in your browser to connect TikTok:\n\n  " + url + "\n")


def cmd_status(args):
    load_dotenv()
    worker = os.environ.get("TIKTOK_WORKER_URL")
    api = os.environ.get("WORKER_API_TOKEN")
    if not (worker and api):
        sys.exit("Needs TIKTOK_WORKER_URL and WORKER_API_TOKEN in .env.")
    req = urllib.request.Request(worker.rstrip("/") + "/api/status",
                                 headers={"Authorization": "Bearer " + api})
    with urllib.request.urlopen(req, timeout=30) as r:
        print(json.dumps(json.load(r), indent=2))


def cmd_creator_info(args):
    load_dotenv()
    token = get_token(args)
    status, data = api_post("/v2/post/publish/creator_info/query/", token, body={})
    print("HTTP", status)
    print(json.dumps(data, indent=2))
    err = (data.get("error") or {}).get("code")
    if err and err != "ok":
        print("\nAPI error code:", err)


def cmd_publish(args):
    load_dotenv()
    if not os.path.exists(args.file):
        sys.exit(f"File not found: {args.file}")
    size = os.path.getsize(args.file)
    total_chunks = max(1, math.ceil(size / CHUNK_SIZE))
    token = get_token(args)

    print(f"Video      : {args.file} ({size:,} bytes, {total_chunks} chunk(s))")
    print(f"Title      : {args.title!r}")
    print(f"Privacy    : {args.privacy}")
    print(f"Cover frame: {args.cover_ms} ms")

    # 1. creator info — required by TikTok UX rules; also validates token
    st, ci = api_post("/v2/post/publish/creator_info/query/", token, body={})
    err = (ci.get("error") or {}).get("code")
    if st != 200 or err not in (None, "ok"):
        sys.exit(f"creator_info failed (HTTP {st}): {json.dumps(ci)}")
    cdata = ci["data"]
    print(f"\nPosting as : @{cdata.get('creator_username')} (max duration "
          f"{cdata.get('max_video_post_duration_sec')} s)")
    if args.privacy not in cdata.get("privacy_level_options", []):
        sys.exit(f"privacy_level {args.privacy!r} not in account options "
                 f"{cdata.get('privacy_level_options')} — pick one of those.")

    if not args.yes:
        print("\nDRY RUN — nothing was sent. Re-run with --yes to publish for real.")
        return

    # 2. init direct post (FILE_UPLOAD)
    st, init = api_post("/v2/post/publish/video/init/", token, body={
        "post_info": {
            "title": args.title,
            "privacy_level": args.privacy,
            "disable_duet": args.disable_duet,
            "disable_comment": args.disable_comment,
            "disable_stitch": args.disable_stitch,
            "video_cover_timestamp_ms": args.cover_ms,
        },
        "source_info": {
            "source": "FILE_UPLOAD",
            "video_size": size,
            "chunk_size": CHUNK_SIZE,
            "total_chunk_count": total_chunks,
        },
    })
    err = (init.get("error") or {}).get("code")
    if st != 200 or err not in (None, "ok"):
        sys.exit(f"video/init failed (HTTP {st}): {json.dumps(init)}")
    publish_id = init["data"]["publish_id"]
    upload_url = init["data"]["upload_url"]
    print(f"\npublish_id : {publish_id}")

    # 3. PUT chunks to upload_url
    ext = os.path.splitext(args.file)[1].lower()
    ctype = {"webm": "video/webm", "mov": "video/quicktime"}.get(ext.lstrip("."), "video/mp4")
    with open(args.file, "rb") as f:
        for i in range(total_chunks):
            blob = f.read(CHUNK_SIZE)
            first, last = i * CHUNK_SIZE, i * CHUNK_SIZE + len(blob) - 1
            req = urllib.request.Request(upload_url, data=blob, method="PUT")
            req.add_header("Content-Type", ctype)
            req.add_header("Content-Length", str(len(blob)))
            req.add_header("Content-Range", f"bytes {first}-{last}/{size}")
            with urllib.request.urlopen(req, timeout=600) as r:
                print(f"uploaded chunk {i + 1}/{total_chunks} -> HTTP {r.status}")

    # 4. poll status
    print("\nPolling publish status...")
    deadline = time.time() + 600
    while time.time() < deadline:
        st, s = api_post("/v2/post/publish/status/fetch/", token,
                         body={"publish_id": publish_id})
        data = s.get("data") or {}
        status_v = data.get("status")
        print(f"  {time.strftime('%H:%M:%S')} {status_v} uploaded_bytes={data.get('uploaded_bytes')}")
        if status_v == "PUBLISH_COMPLETE":
            print("\nPUBLISHED. post_id(s):", data.get("publicaly_available_post_id"))
            print("Note: unaudited apps can only post privately — check visibility on TikTok.")
            return
        if status_v == "FAILED":
            sys.exit(f"FAILED: {data.get('fail_reason')} (see TIKTOK_API.md fail_reason table)")
        time.sleep(5)
    print("Timed out waiting for status; re-check later with `python tiktok_test.py status`.")


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check").set_defaults(func=cmd_check)
    sub.add_parser("connect-url").set_defaults(func=cmd_connect_url)
    sub.add_parser("status").set_defaults(func=cmd_status)

    ci = sub.add_parser("creator-info")
    ci.add_argument("--token", help="override: use this access token directly")
    ci.set_defaults(func=cmd_creator_info)

    pb = sub.add_parser("publish")
    pb.add_argument("--file", required=True)
    pb.add_argument("--title", default="")
    pb.add_argument("--privacy", default="SELF_ONLY",
                    help="must be one of creator_info privacy_level_options")
    pb.add_argument("--cover-ms", type=int, default=1000, dest="cover_ms")
    pb.add_argument("--disable-duet", action="store_true", default=None)
    pb.add_argument("--disable-comment", action="store_true", default=None)
    pb.add_argument("--disable-stitch", action="store_true", default=None)
    pb.add_argument("--token")
    pb.add_argument("--yes", action="store_true", help="actually publish (without it: dry run)")
    pb.set_defaults(func=cmd_publish)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
