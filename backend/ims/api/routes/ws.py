import asyncio
import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis

from ims.api.deps import get_redis

router = APIRouter()


@router.websocket("/ws/incidents")
async def websocket_incidents(websocket: WebSocket, redis: Redis = Depends(get_redis)):
    await websocket.accept()
    pubsub = redis.pubsub()
    await pubsub.subscribe("channel:incidents:updates")
    
    try:
        # Keep connection alive and listen for messages
        while True:
            # Check if client disconnected by waiting for any message with timeout
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass

            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message["type"] == "message":
                data = message["data"]
                # Forward to client
                if isinstance(data, bytes):
                    await websocket.send_text(data.decode("utf-8"))
                else:
                    await websocket.send_text(str(data))
    except WebSocketDisconnect:
        print("[ws] Client disconnected")
    except Exception as e:
        print(f"[ws] Error: {e}")
    finally:
        await pubsub.unsubscribe("channel:incidents:updates")
        await pubsub.close()
