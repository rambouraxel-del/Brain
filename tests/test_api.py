import os, tempfile, importlib.util
from pathlib import Path
from fastapi.testclient import TestClient
p = tempfile.TemporaryDirectory()
os.environ['BRAIN_DB_PATH'] = str(Path(p.name) / 'test.sqlite3')
os.environ['BRAIN_PASSWORD'] = 'This-is-a-long-test-password!'
os.environ['BRAIN_SIGNING_KEY'] = 'this-is-a-really-long-test-signing-key-sufficiently-random'
os.environ['BRAIN_ALLOWED_ORIGINS'] = 'https://rambouraxel-del.github.io'
spec = importlib.util.spec_from_file_location('brainmain',str(Path(__file__).resolve().parents[1] / 'backend' / 'main.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
client = TestClient(m.app)
assert client.get('/api/notes').status_code == 401
assert client.post('/api/login',json={'password':'nope'}).status_code == 401
r=client.post('/api/login',json={'password':os.environ['BRAIN_PASSWORD']}); assert r.status_code==200,r.text
headers={'Authorization':'Bearer '+r.json()['access_token']}
spaces=client.get('/api/spaces',headers=headers);assert spaces.status_code==200,spaces.text
assert len(spaces.json())==5
r=client.post('/api/notes',headers=headers,json={'title':'Une idée de test','content':'Bonjour le cerveau','space':'Inbox','tags':['test']}); assert r.status_code==201,r.text
note=r.json(); assert note['tags']==['test']
r=client.patch('/api/notes/'+note['id'],headers=headers,json={'pinned':True,'space':'Idées'});assert r.status_code==200,r.text
assert r.json()['pinned'] is True and r.json()['space']=='Idées'
assert len(client.get('/api/notes',headers=headers).json())==1
assert client.post('/api/spaces',headers=headers,json={'name':'Jeux vidéo'}).status_code==201
assert client.delete('/api/notes/'+note['id'],headers=headers).status_code==204
assert len(client.get('/api/notes',headers=headers).json())==0
assert client.options('/api/notes',headers={'Origin':'https://rambouraxel-del.github.io','Access-Control-Request-Method':'GET'}).headers['access-control-allow-origin']=='https://rambouraxel-del.github.io'
assert 'access-control-allow-origin' not in client.options('/api/notes',headers={'Origin':'https://evil.example','Access-Control-Request-Method':'GET'}).headers
print('BACKEND TESTS OK')
