from flask import Flask, request, jsonify, send_file
from google.oauth2 import service_account
from googleapiclient.discovery import build
import requests
import json
import os
import datetime

app = Flask(__name__)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
CALENDAR_ID = "avalosciro30@gmail.com"
SCOPES = ['https://www.googleapis.com/auth/calendar']
BASE = os.path.dirname(__file__)


def get_calendar_service():
    service_account_info = json.loads(os.environ.get("GOOGLE_SERVICE_ACCOUNT"))
    creds = service_account.Credentials.from_service_account_info(
        service_account_info, scopes=SCOPES
    )
    return build('calendar', 'v3', credentials=creds)


def transcribir_audio(archivo):
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    files = {"file": ("audio.mp4", archivo.read(), "audio/mp4")}
    data = {"model": "whisper-large-v3-turbo"}
    respuesta = requests.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers=headers,
        files=files,
        data=data
    )
    print(f"Respuesta Groq: {respuesta.json()}")
    return respuesta.json().get("text", "")


def extraer_evento(texto):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    hoy = datetime.date.today().strftime("%Y-%m-%d")
    body = {
        "model": "openai/gpt-oss-20b",
        "messages": [
            {"role": "system", "content": f"""Extraé el evento del texto y respondé SOLO en este formato JSON sin ningún texto extra:
            {{"titulo": "...", "fecha": "YYYY-MM-DD", "hora": "HH:MM"}}
            Hoy es {hoy}. Si no hay fecha específica usá la fecha de hoy. Si no hay hora usá 09:00."""},
            {"role": "user", "content": texto}
        ]
    }
    respuesta = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=headers,
        json=body
    )
    print(f"Respuesta Llama: {respuesta.json()}")
    contenido = respuesta.json()["choices"][0]["message"]["content"]
    return json.loads(contenido)


# ---------- Grabar y agendar ----------
@app.route('/audio', methods=['POST'])
def recibir_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No se recibió audio'}), 400

    texto = transcribir_audio(request.files['audio'])
    print(f"Transcripción: {texto}")
    if not texto.strip():
        return jsonify({'error': 'No se entendió el audio'}), 400

    evento_data = extraer_evento(texto)
    print(f"Evento: {evento_data}")

    service = get_calendar_service()
    fecha_hora = f"{evento_data['fecha']}T{evento_data['hora']}:00"
    evento = {
        'summary': evento_data['titulo'],
        'start': {'dateTime': fecha_hora, 'timeZone': 'America/Argentina/Cordoba'},
        'end': {'dateTime': fecha_hora, 'timeZone': 'America/Argentina/Cordoba'},
    }
    service.events().insert(calendarId=CALENDAR_ID, body=evento).execute()
    print(f"Evento agregado: {evento_data['titulo']}")

    return jsonify({'ok': True, 'evento': evento_data['titulo'], 'transcripcion': texto})


# ---------- Solo transcribir (notas y listas) ----------
@app.route('/transcribir', methods=['POST'])
def solo_transcribir():
    if 'audio' not in request.files:
        return jsonify({'error': 'No se recibió audio'}), 400
    texto = transcribir_audio(request.files['audio'])
    print(f"Transcripción nota: {texto}")
    return jsonify({'ok': True, 'texto': texto})


# ---------- Eventos de hoy ----------
@app.route('/eventos', methods=['GET'])
def obtener_eventos():
    service = get_calendar_service()
    hoy = datetime.date.today()
    resultado = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=f"{hoy}T00:00:00-03:00",
        timeMax=f"{hoy}T23:59:59-03:00",
        singleEvents=True,
        orderBy='startTime'
    ).execute()

    lista = []
    for e in resultado.get('items', []):
        hora = e.get('start', {}).get('dateTime', '')
        lista.append({
            'titulo': e.get('summary', 'Sin titulo'),
            'hora': hora[11:16] if hora else '--:--'
        })
    return jsonify({'eventos': lista})


# ---------- Archivos de la interfaz ----------
@app.route('/app')
def interfaz():
    return send_file(os.path.join(BASE, 'index.html'))


@app.route('/styles.css')
def css():
    return send_file(os.path.join(BASE, 'styles.css'), mimetype='text/css')


@app.route('/app.js')
def js():
    return send_file(os.path.join(BASE, 'app.js'), mimetype='application/javascript')


@app.route('/')
def home():
    return "Backend Llavero funcionando"


if __name__ == '__main__':
    app.run(debug=True, port=5000)