# assessment-summary Specification
## Purpose

Al terminar las lecturas activas, muestra al participante su calificación total, las ayudas que más usó y qué tipos de ayuda le resultaron más efectivos y en cuánto tiempo.

## Requirements
### Requirement: Resumen al terminar todas las lecturas activas
El sistema SHALL mostrar el resumen solo cuando el participante ha completado todas las lecturas activas. No se muestra un resumen por cada lectura.

#### Scenario: Lecturas pendientes
- **WHEN** el participante completa la primera de dos lecturas activas
- **THEN** el sistema presenta la segunda lectura y no muestra el resumen

#### Scenario: Todas completadas
- **WHEN** el participante completa la última lectura activa pendiente
- **THEN** el sistema muestra el resumen

### Requirement: Calificación total
El resumen SHALL mostrar los puntos obtenidos, los puntos máximos posibles y el porcentaje, sumando todas las lecturas incluidas.

#### Scenario: Cálculo de la calificación
- **WHEN** el participante obtuvo 190 de 300 en una lectura y 150 de 200 en otra
- **THEN** el resumen muestra 340 de 500 (68%)

### Requirement: Ayudas más usadas
El resumen SHALL mostrar cuántas veces se usó cada tipo de ayuda, ordenados de mayor a menor uso. El Léxico mostrado como retroalimentación tras una respuesta incorrecta MUST NOT contarse como ayuda usada.

#### Scenario: Conteo de ayudas
- **WHEN** el participante pidió Radicación en tres palabras y Contexto en dos
- **THEN** el resumen muestra Radicación (3) antes que Contexto (2)

#### Scenario: Léxico por fallo excluido
- **WHEN** el participante falla una palabra sin pedir ayudas y el sistema le muestra el Léxico
- **THEN** ese Léxico no aparece en el conteo de ayudas usadas

### Requirement: Efectividad por tipo de ayuda
El sistema SHALL atribuir cada respuesta a la última ayuda pedida antes de responder. La efectividad de un tipo SHALL ser sus aciertos divididos entre todas las respuestas atribuidas a él. Las respuestas sin ayudas no se atribuyen a ningún tipo.

#### Scenario: Atribución de aciertos y fallos
- **WHEN** el participante acierta una palabra tras pedir solo Radicación y falla otra tras pedir solo Radicación
- **THEN** la efectividad de Radicación es 1 de 2 (50%)

#### Scenario: Atribución a la última ayuda
- **WHEN** el participante pide Radicación y Contexto y luego acierta
- **THEN** el acierto se atribuye a Contexto y no a Radicación

#### Scenario: Sin ayudas
- **WHEN** el participante acierta una palabra sin pedir ayudas
- **THEN** esa respuesta no cuenta para la efectividad de ningún tipo

#### Scenario: Tipo sin respuestas atribuidas
- **WHEN** ninguna respuesta se atribuye a Sinonimia
- **THEN** el resumen muestra Sinonimia sin valor de efectividad en lugar de 0%

### Requirement: Tiempo por tipo de ayuda
El resumen SHALL mostrar, para cada tipo de ayuda con respuestas atribuidas, el tiempo promedio entre la entrega de esa ayuda y la respuesta, con los tiempos registrados por el servidor.

#### Scenario: Tiempo promedio
- **WHEN** dos respuestas atribuidas a Radicación llegaron 6 y 10 segundos después de entregar la ayuda
- **THEN** el resumen muestra 8 segundos como tiempo promedio de Radicación

### Requirement: Resumen de repeticiones con aviso oficial
Cuando el participante completa las lecturas en un intento posterior al primero, el resumen SHALL mostrar los resultados de ese último intento junto con un aviso de que la calificación oficial es la del primer intento, indicando esa calificación.

#### Scenario: Resumen tras repetir
- **WHEN** un participante con calificación oficial de 340 de 500 repite las lecturas y obtiene 410
- **THEN** el resumen muestra 410 de 500 como resultado del intento y avisa que la calificación oficial es 340 de 500
