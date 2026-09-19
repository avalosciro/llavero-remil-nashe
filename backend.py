from flask import Flask, request, jsonify
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from openai import OpenAI
import datetime
import pickle
import os

app = Flask(__name__)
client = OpenAI()

SCOPES = ['https://www.googleapis.com/auth/calendar']

def get_calendar_service():
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    return build('calendar', 'v3', credentials=creds)

@app.route('/audio', methods=['POST'])
def recibir_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No se recibió audio'}), 400

    audio_file = request.files['audio']
    audio_file.save('audio_temp.wav')

    # Transcribir con Whisper
    with open('audio_temp.wav', 'rb') as f:
        transcripcion = client.audio.transcriptions.create(
            model="whisper-1",
            file=f
        )
    texto = transcripcion.text
    print(f"Transcripción: {texto}")

    # Extraer evento con IA
    respuesta = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """Extraé el evento del texto y respondé SOLO en este formato JSON:
            {"titulo": "...", "fecha": "YYYY-MM-DD", "hora": "HH:MM"}
            Si no hay fecha específica usá la fecha de hoy.
            Si no hay hora específica usá 09:00."""},
            {"role": "user", "content": texto}
        ]
    )

    import json
    evento_data = json.loads(respuesta.choices[0].message.content)
    print(f"Evento extraído: {evento_data}")

    # Agregar a Google Calendar
    service = get_calendar_service()
    fecha_hora_inicio = f"{evento_data['fecha']}T{evento_data['hora']}:00"
    fecha_hora_fin = f"{evento_data['fecha']}T{evento_data['hora']}:00"

    evento = {
        'summary': evento_data['titulo'],
        'start': {'dateTime': fecha_hora_inicio, 'timeZone': 'America/Argentina/Cordoba'},
        'end': {'dateTime': fecha_hora_fin, 'timeZone': 'America/Argentina/Cordoba'},
    }

    service.events().insert(calendarId='primary', body=evento).execute()
    print(f"Evento agregado: {evento_data['titulo']}")

    return jsonify({'ok': True, 'evento': evento_data['titulo'], 'transcripcion': texto})

if __name__ == '__main__':
    app.run(debug=True, port=5000)