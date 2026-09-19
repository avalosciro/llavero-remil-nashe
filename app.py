from flask import Flask, request, jsonify
from google.oauth2 import service_account
from googleapiclient.discovery import build
import requests
import json
import os

app = Flask(__name__)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
SERVICE_ACCOUNT_FILE = "service_account.json"
SCOPES = ['https://www.googleapis.com/auth/calendar']

def get_calendar_service():
    service_account_info = json.loads(os.environ.get("GOOGLE_SERVICE_ACCOUNT"))
    creds = service_account.Credentials.from_service_account_info(
        service_account_info, scopes=SCOPES
    )
    return build('calendar', 'v3', credentials=creds)
def transcribir_audio(archivo):
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    files = {"file": ("audio.wav", archivo, "audio/wav")}
    data = {"model": "whisper-large-v3-turbo"}
    respuesta = requests.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers=headers,
        files=files,
        data=data
    )
    return respuesta.json().get("text", "")

def extraer_evento(texto):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    hoy = __import__('datetime').date.today().strftime("%Y-%m-%d")
    body = {
        "model": "llama-3.2-3b-preview",
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
    contenido = respuesta.json()["choices"][0]["message"]["content"]
    return json.loads(contenido)

@app.route('/audio', methods=['POST'])
def recibir_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No se recibió audio'}), 400

    audio_file = request.files['audio']
    texto = transcribir_audio(audio_file)
    print(f"Transcripción: {texto}")

    evento_data = extraer_evento(texto)
    print(f"Evento: {evento_data}")

    service = get_calendar_service()
    fecha_hora = f"{evento_data['fecha']}T{evento_data['hora']}:00"
    evento = {
        'summary': evento_data['titulo'],
        'start': {'dateTime': fecha_hora, 'timeZone': 'America/Argentina/Cordoba'},
        'end': {'dateTime': fecha_hora, 'timeZone': 'America/Argentina/Cordoba'},
    }
    service.events().insert(calendarId='primary', body=evento).execute()
    print(f"Evento agregado: {evento_data['titulo']}")

    return jsonify({'ok': True, 'evento': evento_data['titulo'], 'transcripcion': texto})

@app.route('/')
def home():
    return "Backend Llavero funcionando"

if __name__ == '__main__':
    app.run(debug=True, port=5000)