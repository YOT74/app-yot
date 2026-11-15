# lancer.py — démarre l'app en local et ouvre le navigateur.
# Dans Spyder : ouvrir ce fichier, puis Exécuter (F5).
# Pour arrêter : bouton carré rouge de la console, ou Ctrl+C dans la console.
import functools
import http.server
import os
import webbrowser

PORT = 8000
DOSSIER = os.path.dirname(os.path.abspath(__file__))  # le dossier de l'app, quel que soit l'endroit

gestionnaire = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DOSSIER)

try:
    serveur = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), gestionnaire)
except OSError:
    print(f"Le port {PORT} est déjà utilisé : le serveur tourne sans doute déjà.")
    print(f"Ouvre http://localhost:{PORT} ou redémarre la console (Consoles > Redémarrer le noyau).")
else:
    print(f"App servie depuis {DOSSIER}")
    print(f"Ouverture de http://localhost:{PORT} … (arrêt : bouton carré rouge ou Ctrl+C)")
    webbrowser.open(f"http://localhost:{PORT}")
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        serveur.server_close()
        print("Serveur arrêté.")
