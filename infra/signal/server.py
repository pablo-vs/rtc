print("Starting")

from aiohttp import web
import ssl
import socketio
import struct

sio = socketio.AsyncServer(cors_allowed_origins='*', ping_timeout=35)
app = web.Application()
ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
ssl_context.load_cert_chain('/signaling/fullchain.pem', '/signaling/privkey.pem')
sio.attach(app)

clients = dict()
rooms = {"123"}

def hashCode(string):
    h = 0
    if len(string) == 0:
        return 0;
    for c in string:
        h = ((h<<5) - h) + ord(c)
        h = h & ((1<<32)-1)
        h = struct.unpack('<1i', h.to_bytes(4, byteorder='little'))[0]
        print(h)

    print(hex(h))
    return f"{abs(h):08x}"

@sio.event
async def connect(sid, environ):
    print('Connecting', sid)

@sio.event
async def setup(sid, data):
    print(data)
    if 'id' not in data or data['id'] in clients:
        return False, "Client already connected"
    if 'room' not in data:
        return False, "Missing room identifier"
    else:
        if data['room'] not in rooms:
            if 'host' not in data or data['host'] is None:
                return False, "Room does not exist"
            elif hashCode(data['host']) != data['room']:
                print(hashCode(data['host']))
                return False, "Could not verify host"
            else:
                rooms.add(data['room'])

    clients[data['id']] = sid
    await sio.save_session(sid, {'id' : data['id'], 'room' : data['room']})   
    await sio.emit('ready', data={'id': data['id']}, room=data['room'], skip_sid=sid)
    sio.enter_room(sid, data['room'])
    print('Connected', sid, data['id'])
    return True, None

@sio.event
async def disconnect(sid):
    sess = await sio.get_session(sid)
    sio.leave_room(sid, sess['room'])
    clients.pop(sess['id'])
    await sio.emit("disconnected", data={'id': sess['id']}, room=sess['room']);
    print('Disconnected', sid)

@sio.event
async def data(sid, data):
    print(f'Message from {data["from"]} to {data["to"]}: {data}')
    await sio.emit('data', data, to=clients[data["to"]], skip_sid=sid)


if __name__ == '__main__':
    print("Started")
    web.run_app(app, ssl_context=ssl_context, port=9999)
    #web.run_app(app, port=9999)
