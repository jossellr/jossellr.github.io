#!/bin/bash

# Función para generar la elección de la computadora
function eleccion_computadora {
  VALOR=$((RANDOM % 3))
  case $VALOR in
    0)
      echo "piedra"
      ;;
    1)
      echo "papel"
      ;;
    2)
      echo "tijera"
      ;;
  esac
}

# Función para determinar el ganador
function determinar_ganador {
  if [[ $1 == $2 ]]; then
    echo "Empate!"
  elif [[ ($1 == "piedra" && $2 == "tijera") || ($1 == "papel" && $2 == "piedra") || ($1 == "tijera" && $2 == "papel") ]]; then
    echo "¡Ganaste!"
  else
    echo "La computadora gana."
  fi
}

# Juego principal
echo "Juego de Piedra, Papel o Tijeras"
echo "Elige tu opción (piedra, papel, tijera):"
read eleccion_usuario
eleccion_usuario=$(echo $eleccion_usuario | tr '[:upper:]' '[:lower:]') # Convertir a minúsculas

# Validar la elección del usuario
if [[ $eleccion_usuario != "piedra" && $eleccion_usuario != "papel" && $eleccion_usuario != "tijera" ]]; then
  echo "Elección inválida."
  exit 1
fi

eleccion_pc=$(eleccion_computadora)
echo "Tu elección: $eleccion_usuario. Elección de la computadora: $eleccion_pc."
determinar_ganador $eleccion_usuario $eleccion_pc