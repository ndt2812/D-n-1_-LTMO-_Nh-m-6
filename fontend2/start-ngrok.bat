@echo off
REM Batch script để start ngrok (cho Windows)
powershell -ExecutionPolicy Bypass -File "%~dp0start-ngrok.ps1" %*


