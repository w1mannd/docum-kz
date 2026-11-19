"""Имитация NCALayer для проверки сайта на компьютере разработчика (в сайт не входит).
Отвечает в формате модуля kz.gov.pki.knca.basics и подписывает тестовым RSA-сертификатом через openssl.
python mock_ncalayer.py ПАПКА_С_cert.pem_И_key.pem [порт]   затем в консоли сайта на localhost:
localStorage.setItem('docum-ncalayer', 'ws://127.0.0.1:13580/')"""
import asyncio, base64, json, os, subprocess, sys, tempfile
import websockets

KEYS = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 13580


def sign(data):
    with tempfile.TemporaryDirectory() as d:
        src, out = os.path.join(d, 'in.bin'), os.path.join(d, 'out.cms')
        open(src, 'wb').write(data)
        subprocess.run(['openssl', 'smime', '-sign', '-nodetach', '-binary', '-in', src, '-signer', os.path.join(KEYS, 'cert.pem'),
                        '-inkey', os.path.join(KEYS, 'key.pem'), '-outform', 'DER', '-md', 'sha256', '-out', out], check=True)
        return base64.b64encode(open(out, 'rb').read()).decode()


async def handler(ws):
    await ws.send(json.dumps({'result': {'version': '1.4-mock'}}))
    async for msg in ws:
        req = json.loads(msg)
        if req.get('module') == 'kz.gov.pki.knca.basics' and req.get('method') == 'sign':
            data = base64.b64decode(req['args']['data'])
            print('подписываю', len(data), 'байт', flush=True)
            await ws.send(json.dumps({'status': True, 'body': {'result': [sign(data)]}}))
        else:
            await ws.send(json.dumps({'status': False, 'code': '500', 'message': 'module not found'}))


async def main():
    async with websockets.serve(handler, '127.0.0.1', PORT, max_size=20_000_000):
        print('mock NCALayer ws://127.0.0.1:%d' % PORT, flush=True)
        await asyncio.Future()

asyncio.run(main())
