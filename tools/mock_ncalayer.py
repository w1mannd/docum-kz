"""Имитация NCALayer для проверки сайта на компьютере разработчика (в сайт не входит).
Отвечает в формате модуля kz.gov.pki.knca.basics и подписывает тестовым RSA-сертификатом через openssl.
python mock_ncalayer.py ПАПКА_С_cert.pem_И_key.pem [порт]   затем в консоли сайта на localhost:
localStorage.setItem('docum-ncalayer', 'ws://127.0.0.1:13580/')"""
import asyncio, base64, json, os, subprocess, sys, tempfile
import websockets

KEYS = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 13580


def add_tsp(cms_der):
    """Метка времени, как у НУЦ: токен RFC 3161 на значение подписи — в неподписанные атрибуты (pyHanko, тестовый TSA)."""
    import asyncio as aio, hashlib
    from asn1crypto import cms, pem, x509, keys
    from pyhanko.sign.timestamps.dummy_client import DummyTimeStamper
    cert = x509.Certificate.load(pem.unarmor(open(os.path.join(KEYS, 'cert.pem'), 'rb').read())[2])
    key = keys.PrivateKeyInfo.load(pem.unarmor(open(os.path.join(KEYS, 'key.pem'), 'rb').read())[2])
    ci = cms.ContentInfo.load(cms_der)
    si = ci['content']['signer_infos'][0]
    digest = hashlib.sha256(si['signature'].native).digest()
    token = aio.run(DummyTimeStamper(cert, key).async_timestamp(digest, 'sha256'))
    si['unsigned_attrs'] = cms.CMSAttributes([cms.CMSAttribute({'type': 'signature_time_stamp_token', 'values': [token]})])
    return ci.dump(force=True)


def sign(data, attach=True, tsp=False):
    with tempfile.TemporaryDirectory() as d:
        src, out = os.path.join(d, 'in.bin'), os.path.join(d, 'out.cms')
        open(src, 'wb').write(data)
        subprocess.run(['openssl', 'smime', '-sign'] + (['-nodetach'] if attach else []) + ['-binary', '-in', src, '-signer', os.path.join(KEYS, 'cert.pem'),
                        '-inkey', os.path.join(KEYS, 'key.pem'), '-outform', 'DER', '-md', 'sha256', '-out', out], check=True)
        der = open(out, 'rb').read()
        return base64.b64encode(add_tsp(der) if tsp else der).decode()


async def handler(ws):
    await ws.send(json.dumps({'result': {'version': '1.4-mock'}}))
    async for msg in ws:
        req = json.loads(msg)
        if req.get('module') == 'kz.gov.pki.knca.basics' and req.get('method') == 'sign':
            data = base64.b64decode(req['args']['data'])
            print('подписываю', len(data), 'байт', flush=True)
            sp = req['args'].get('signingParams', {})
            attach = sp.get('encapsulate', True)
            tsp = sp.get('tsaProfile') is not None
            await ws.send(json.dumps({'status': True, 'body': {'result': [await asyncio.to_thread(sign, data, attach, tsp)]}}))
        elif req.get('module') == 'kz.gov.pki.knca.commonUtils' and req.get('method') == 'getKeyInfo':
            pem = open(os.path.join(KEYS, 'cert.pem')).read()
            await ws.send(json.dumps({'code': '200', 'responseObject': {'alias': 'test', 'pem': pem}}))
        else:
            await ws.send(json.dumps({'status': False, 'code': '500', 'message': 'module not found'}))


async def main():
    async with websockets.serve(handler, '127.0.0.1', PORT, max_size=20_000_000):
        print('mock NCALayer ws://127.0.0.1:%d' % PORT, flush=True)
        await asyncio.Future()

asyncio.run(main())
