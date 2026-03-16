#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWM1ZWI2YS0wODJjLTQxMWMtYjBlMy0yZGMxZThjNDUwMDEiLCJlbWFpbCI6ImFkbWluQGNhbmNoaXB1ci5lZHUiLCJyb2xlSWQiOiI1NmI1ZjVmMi1hZjNkLTQxZTktYTcyYi01ZTFjNjI4OTA0ZTQiLCJyb2xlVHlwZSI6IkFETUlOIiwic2Nob29sSWQiOiI0ZWYzNjNlNS02NzA5LTRmOGMtYTM2NC0yYmYwM2ZmZTEwZTkiLCJpYXQiOjE3NzM2ODU1NDYsImV4cCI6MTc3MzY4NjQ0Nn0.LD-2pD0MN4QRycmfvw6S5dhXzQD0rL-xm0ZY5dIKThg"

BASE="http://localhost:3000/api/v1"

echo "===== AUTH TEST ====="
curl -s $BASE/auth/sessions -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== NOTICES ====="
curl -s $BASE/notices -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== CIRCULARS ====="
curl -s $BASE/circulars -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== NOTIFICATIONS ====="
curl -s $BASE/notifications -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== STUDENTS ====="
curl -s $BASE/students -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== TEACHERS ====="
curl -s $BASE/teachers -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== CLASSES ====="
curl -s $BASE/classes -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== SECTIONS ====="
curl -s $BASE/sections -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== SUBJECTS ====="
curl -s $BASE/subjects -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== PERIODS ====="
curl -s $BASE/periods -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== TIMETABLE SLOTS ====="
curl -s $BASE/timetable-slots -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== STUDENT ATTENDANCE ====="
curl -s $BASE/student-attendance -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== STUDENT LEAVES ====="
curl -s $BASE/student-leaves -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== TEACHER LEAVES ====="
curl -s $BASE/teacher-leaves -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== ACADEMIC YEARS ====="
curl -s $BASE/academic-years -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo "===== TEST COMPLETE ====="
