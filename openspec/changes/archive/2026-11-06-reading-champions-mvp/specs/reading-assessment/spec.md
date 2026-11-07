# Spec Delta

## Purpose

Evalúa la comprensión del vocabulario de un participante en lecturas cortas mediante preguntas de opción múltiple sobre palabras objetivo, con ayudas graduales que reducen el puntaje, todo calculado de forma autoritativa en el servidor.

## ADDED Requirements

### Requirement: Solo las palabras objetivo se evalúan
El sistema SHALL calificar una lectura únicamente con sus palabras objetivo. Cada palabra objetivo vale 100 puntos como máximo y el máximo de la lectura es 100 por el número de palabras objetivo.

#### Scenario: Lectura con tres palabras objetivo
- **WHEN** un participante inicia una lectura con tres palabras objetivo
- **THEN** el sistema evalúa exactamente tres preguntas y el puntaje máximo de la lectura es 300

### Requirement: Primera aparición sin distinguir mayúsculas
El sistema SHALL ubicar cada palabra objetivo en su primera aparición como palabra completa dentro del texto, sin distinguir mayúsculas de minúsculas. El resaltado y las ayudas se muestran solo en esa aparición.

#### Scenario: Palabra repetida con mayúscula
- **WHEN** el texto es "El Banco cerró temprano. Fui al banco del parque." y la palabra objetivo es "banco"
- **THEN** el sistema resalta y evalúa solo "Banco" en la primera oración

#### Scenario: Coincidencia parcial ignorada
- **WHEN** el texto contiene "desbancar" antes de "banco" y la palabra objetivo es "banco"
- **THEN** el sistema ubica la palabra objetivo en "banco", no dentro de "desbancar"

### Requirement: Una pregunta a la vez en orden de aparición
El sistema SHALL presentar las palabras objetivo de una en una, en el orden en que aparecen en el texto, y SHALL presentar la siguiente solo cuando la actual está cerrada. El párrafo completo permanece visible con la palabra actual resaltada.

#### Scenario: Avance secuencial
- **WHEN** el participante responde la primera palabra objetivo
- **THEN** el sistema cierra esa palabra y presenta la segunda según su posición en el texto

#### Scenario: Intento de saltar una pregunta
- **WHEN** el cliente solicita ayudas o responde una palabra objetivo que no es la actual
- **THEN** el servidor rechaza la solicitud y no cambia el estado del intento

### Requirement: Opción múltiple con una única respuesta correcta
El sistema SHALL presentar cada palabra objetivo como una pregunta de opción múltiple con exactamente una opción correcta. El servidor MUST NOT enviar al cliente qué opción es correcta antes de que la palabra esté cerrada.

#### Scenario: Opciones presentadas
- **WHEN** el sistema presenta una palabra objetivo
- **THEN** el cliente recibe el texto de las opciones sin ningún indicador de cuál es correcta

### Requirement: Ayudas opcionales en orden fijo
El sistema SHALL ofrecer cuatro ayudas por palabra objetivo en este orden fijo: Radicación, Contexto, Sinonimia y Léxico. El participante puede responder en cualquier momento sin pedir ayudas. Cada solicitud entrega solo la siguiente ayuda de la secuencia.

#### Scenario: Primera ayuda
- **WHEN** el participante pide una ayuda en una palabra sin ayudas usadas
- **THEN** el servidor registra la ayuda de Radicación y devuelve únicamente su contenido

#### Scenario: Responder sin ayudas
- **WHEN** el participante responde sin haber pedido ninguna ayuda
- **THEN** el sistema acepta la respuesta y la puntúa con el valor completo

#### Scenario: Sin más ayudas
- **WHEN** el participante ya recibió el Léxico y pide otra ayuda
- **THEN** el servidor rechaza la solicitud y el estado no cambia

#### Scenario: Ayudas no pedidas ocultas
- **WHEN** el cliente recibe una pregunta o una ayuda
- **THEN** la respuesta del servidor no contiene el contenido de ninguna ayuda que no se haya pedido

### Requirement: Puntaje según la ayuda alcanzada
El sistema SHALL puntuar una respuesta correcta restando de 100 la penalización acumulada de las ayudas usadas: Radicación −15, Contexto −15, Sinonimia −30 y Léxico −20. Los valores posibles son 100, 85, 70, 40 y 20.

#### Scenario: Acierto con dos ayudas
- **WHEN** el participante pide Radicación y Contexto y luego responde correctamente
- **THEN** el sistema otorga 70 puntos a esa palabra

#### Scenario: Acierto con todas las ayudas
- **WHEN** el participante pide las cuatro ayudas y luego responde correctamente
- **THEN** el sistema otorga 20 puntos a esa palabra

### Requirement: Respuesta incorrecta
El sistema SHALL otorgar 0 puntos a una respuesta incorrecta, sin importar las ayudas usadas, y SHALL mostrar el Léxico y resaltar la opción correcta como retroalimentación.

#### Scenario: Falla sin ayudas
- **WHEN** el participante responde una opción incorrecta
- **THEN** el sistema otorga 0 puntos, muestra el Léxico de la palabra y resalta la opción correcta

### Requirement: Palabra cerrada al responder
El sistema SHALL cerrar una palabra objetivo en cuanto recibe su respuesta, sea correcta o incorrecta. Una palabra cerrada MUST NOT aceptar más respuestas ni ayudas.

#### Scenario: Segundo intento de respuesta
- **WHEN** el cliente envía otra respuesta para una palabra ya cerrada
- **THEN** el servidor rechaza la solicitud y conserva el puntaje original

### Requirement: Puntaje calculado por el servidor
El sistema SHALL calcular todos los puntajes en el servidor a partir de las ayudas registradas y la opción elegida. Cualquier puntaje, nivel de ayuda o resultado enviado por el cliente MUST ser ignorado.

#### Scenario: Cliente envía un puntaje
- **WHEN** una solicitud de respuesta incluye un campo de puntaje o de ayudas usadas
- **THEN** el servidor ignora esos campos y calcula el puntaje con su propio registro

### Requirement: Tiempos medidos por el servidor
El sistema SHALL registrar con el reloj del servidor el momento en que se presenta cada pregunta, cada ayuda pedida y la respuesta, y SHALL derivar de ellos los tiempos de respuesta.

#### Scenario: Registro de tiempos
- **WHEN** se presenta una pregunta, el participante pide una ayuda y luego responde
- **THEN** el servidor tiene registrados los tres instantes con su propio reloj

### Requirement: Intentos reanudables
El sistema SHALL conservar el estado de un intento en curso, incluidas las palabras cerradas y el nivel de ayuda de la palabra actual, para que el participante lo continúe al volver a ingresar.

#### Scenario: Reingreso a mitad de una lectura
- **WHEN** un participante cierra el navegador después de pedir una ayuda y vuelve a ingresar con su documento
- **THEN** el sistema retoma la misma palabra con las ayudas ya reveladas y sin restablecer la penalización

### Requirement: Solo el primer intento es oficial
El sistema SHALL permitir repetir lecturas en intentos posteriores, pero SHALL tomar como oficial únicamente el primer intento de cada participante en cada lectura. Un intento posterior MUST NOT modificar el resultado oficial.

#### Scenario: Repetición de una lectura
- **WHEN** un participante que ya completó una lectura con 190 puntos la repite y obtiene 260
- **THEN** el resultado oficial de esa lectura sigue siendo 190 y el de 260 se guarda como práctica

### Requirement: Solo se presentan lecturas activas
El sistema SHALL ofrecer a los participantes solo las lecturas activas, en un orden definido, y SHALL pasar a la siguiente lectura activa al completar la actual.

#### Scenario: Siguiente lectura
- **WHEN** el participante completa la primera lectura activa
- **THEN** el sistema le presenta la siguiente lectura activa

#### Scenario: Lectura inactiva
- **WHEN** una lectura está inactiva
- **THEN** el sistema no la ofrece a los participantes
