print("Starting")

from aiohttp import web
import ssl
import socketio

ROOM = 'room'

sio = socketio.AsyncServer(cors_allowed_origins='*', ping_timeout=35)
app = web.Application()
ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
ssl_context.load_cert_chain('/signaling/fullchain.pem', '/signaling/privkey.pem')
sio.attach(app)

clients = dict()

@sio.event
async def connect(sid, environ):
    print('Connecting', sid)

@sio.event
async def setup(sid, data):
    print(data)
    if 'id' not in data or data['id'] in clients:
        return False
    clients[data['id']] = sid
    await sio.save_session(sid, {'id' : data['id']})   
    await sio.emit('ready', data={'id': data['id']}, room=ROOM, skip_sid=sid)
    sio.enter_room(sid, ROOM)
    print('Connected', sid, data['id'])

@sio.event
async def disconnect(sid):
    sio.leave_room(sid, ROOM)
    sess = await sio.get_session(sid)
    clients.pop(sess['id'])
    print('Disconnected', sid)


@sio.event
async def data(sid, data):
    print(f'Message from {data["from"]} to {data["to"]}: {data}')
    await sio.emit('data', data, to=clients[data["to"]], skip_sid=sid)


if __name__ == '__main__':
    print("Started")
    web.run_app(app, ssl_context=ssl_context, port=9999)
    #web.run_app(app, port=9999)
