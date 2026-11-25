@echo off
echo Menjalankan Python Atmospheric Data Pipeline...
python "%~dp0python\process_atmospheric_data.py"
echo.
echo Membuka Web Visualization Platform di http://localhost:8000
start http://localhost:8000
cd /d "%~dp0web"
python -m http.server 8000
