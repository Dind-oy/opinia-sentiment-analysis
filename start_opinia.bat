::[Bat To Exe Converter]
::
::YAwzoRdxOk+EWAjk
::fBw5plQjdCyDJGyX8VAjFD9bVQ2MAE+1EbsQ5+n//NaLrUoSGus8d+8=
::YAwzuBVtJxjWCl3EqQJgSA==
::ZR4luwNxJguZRRnk
::Yhs/ulQjdF+5
::cxAkpRVqdFKZSjk=
::cBs/ulQjdF+5
::ZR41oxFsdFKZSDk=
::eBoioBt6dFKZSDk=
::cRo6pxp7LAbNWATEpCI=
::egkzugNsPRvcWATEpCI=
::dAsiuh18IRvcCxnZtBJQ
::cRYluBh/LU+EWAnk
::YxY4rhs+aU+JeA==
::cxY6rQJ7JhzQF1fEqQJQ
::ZQ05rAF9IBncCkqN+0xwdVs0
::ZQ05rAF9IAHYFVzEqQJQ
::eg0/rx1wNQPfEVWB+kM9LVsJDGQ=
::fBEirQZwNQPfEVWB+kM9LVsJDGQ=
::cRolqwZ3JBvQF1fEqQJQ
::dhA7uBVwLU+EWDk=
::YQ03rBFzNR3SWATElA==
::dhAmsQZ3MwfNWATElA==
::ZQ0/vhVqMQ3MEVWAtB9wSA==
::Zg8zqx1/OA3MEVWAtB9wSA==
::dhA7pRFwIByZRRnk
::Zh4grVQjdCyDJGyX8VAjFD9bVQ2MAESqD7sV6abe18/n
::YB416Ek+ZG8=
::
::
::978f952a14a936cc963da21a135fa983
@echo off

:: Cari lokasi XAMPP
if exist "C:\xampp\xampp-control.exe" (
    set XAMPP=C:\xampp
) else if exist "D:\xampp\xampp-control.exe" (
    set XAMPP=D:\xampp
) else (
    echo XAMPP tidak ditemukan!
    pause
    exit
)

:: Buka XAMPP
start "" "%XAMPP%\xampp-control.exe"

timeout /t 5

:: Jalankan FastAPI
start cmd /k "cd /d %XAMPP%\htdocs\program\python && uvicorn app:app --reload"

timeout /t 5

:: Buka aplikasi
start http://localhost/program