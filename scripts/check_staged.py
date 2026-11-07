"""Verifica os arquivos do índice antes do commit; não lê datasets locais."""
from pathlib import PurePosixPath
import subprocess

FORBIDDEN = {'.npz', '.npy', '.nc', '.csv', '.parquet', '.zip', '.joblib', '.pkl', '.pickle', '.onnx', '.h5', '.db', '.pem', '.key', '.p12', '.pfx', '.log'}
FOLDERS = {'data', 'artifacts', '.venv', 'venv', 'node_modules', 'dist', 'build', '__pycache__', '.aws', '.ssh'}
# A geometria pública do mapa é código de apoio à interface, não o dataset meteorológico.
EXCEPTIONS = {'frontend/src/data/londrina-ibge.json'}

def allowed(name):
    path = PurePosixPath(name)
    base = path.name.lower()
    return name in EXCEPTIONS or not (
        path.suffix.lower() in FORBIDDEN
        or any(part.lower() in FOLDERS for part in path.parts)
        or (base.startswith('.env') and base != '.env.example')
        or base.startswith(('credentials', 'secrets'))
    )

def main():
    entries = subprocess.check_output(['git', 'ls-files', '--stage', '-z']).decode().split('\0')
    failures = []
    for entry in filter(None, entries):
        metadata, name = entry.split('\t', 1)
        mode, oid, stage = metadata.split()
        size = int(subprocess.check_output(['git', 'cat-file', '-s', oid]))
        if mode not in {'100644', '100755'} or stage != '0' or not allowed(name) or size > 1_000_000:
            failures.append(name)
    if failures:
        raise SystemExit('Commit bloqueado: ' + ', '.join(failures))
    print('Índice verificado: nenhum dataset/modelo/ambiente e arquivos até 1 MB.')

if __name__ == '__main__':
    main()
