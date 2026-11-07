# participant-identity Specification
## Purpose

Permite que estudiantes y adultos se identifiquen con su número de documento y nombre completo para presentar las lecturas, sin contraseña en el MVP.

## Requirements
### Requirement: Ingreso con documento y nombre
El sistema SHALL exigir número de documento y nombre completo antes de iniciar cualquier lectura. Ambos campos son obligatorios y se recortan los espacios al inicio y al final.

#### Scenario: Ingreso válido
- **WHEN** un participante envía un número de documento y un nombre completo no vacíos
- **THEN** el sistema abre una sesión de participante y le permite iniciar las lecturas

#### Scenario: Campos vacíos
- **WHEN** un participante envía el documento o el nombre vacío o compuesto solo de espacios
- **THEN** el sistema rechaza el ingreso con un mensaje de validación y no crea ninguna sesión

### Requirement: El documento identifica al participante
El sistema SHALL tratar el número de documento como identificador único del participante. Un documento no registrado crea un participante nuevo; un documento ya registrado reutiliza el participante existente.

#### Scenario: Documento nuevo
- **WHEN** un participante ingresa con un número de documento que no existe
- **THEN** el sistema registra un participante nuevo con ese documento y ese nombre

#### Scenario: Documento existente
- **WHEN** un participante ingresa con un número de documento ya registrado
- **THEN** el sistema asocia la sesión al participante existente y no crea uno nuevo

#### Scenario: Documento distinto
- **WHEN** una persona ingresa con un número de documento diferente al de un registro anterior, aunque use el mismo nombre
- **THEN** el sistema la registra como un participante nuevo

### Requirement: Se conserva el primer nombre registrado
El sistema SHALL conservar el nombre del primer registro de un documento e ignorar nombres distintos enviados en ingresos posteriores.

#### Scenario: Reingreso con otro nombre
- **WHEN** un participante registrado como "Ana Pérez" vuelve a ingresar con el mismo documento y el nombre "Ana P."
- **THEN** el sistema mantiene "Ana Pérez" como nombre del participante en sesiones y resúmenes

### Requirement: Sesión de participante emitida por el servidor
El sistema SHALL emitir la sesión de participante desde el servidor y SHALL rechazar cualquier operación de evaluación que no venga con una sesión válida.

#### Scenario: Operación sin sesión
- **WHEN** una solicitud de evaluación llega sin sesión válida o con una sesión manipulada
- **THEN** el servidor responde no autorizado y no registra ninguna acción
