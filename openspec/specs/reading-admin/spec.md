# reading-admin Specification
## Purpose

Permite al administrador crear y mantener las lecturas con sus palabras objetivo, ayudas y opciones de respuesta, y decidir qué lecturas están activas para los participantes.

## Requirements
### Requirement: Acceso de administrador con contraseña
El sistema SHALL proteger todas las funciones de administración con usuario y contraseña de administrador. Las contraseñas MUST guardarse solo como hash. Los participantes MUST NOT poder acceder a estas funciones.

#### Scenario: Credenciales válidas
- **WHEN** un administrador ingresa usuario y contraseña correctos
- **THEN** el sistema abre una sesión de administrador

#### Scenario: Credenciales inválidas
- **WHEN** alguien ingresa una contraseña incorrecta
- **THEN** el sistema rechaza el acceso sin indicar cuál de los dos datos falló

#### Scenario: Participante intenta administrar
- **WHEN** una solicitud de administración llega con una sesión de participante
- **THEN** el servidor responde no autorizado

### Requirement: Gestión de lecturas
El administrador SHALL poder crear, editar y listar lecturas. Cada lectura tiene un título, un párrafo de texto y una posición que define el orden en que se presenta a los participantes.

#### Scenario: Crear lectura
- **WHEN** el administrador guarda una lectura con título y texto
- **THEN** el sistema la crea en estado inactivo

### Requirement: Palabras objetivo presentes en el texto
El administrador SHALL poder agregar a una lectura una o más palabras objetivo. El sistema SHALL rechazar una palabra objetivo que no aparezca como palabra completa en el texto, sin distinguir mayúsculas, y SHALL rechazar dos palabras objetivo iguales en la misma lectura.

#### Scenario: Palabra ausente
- **WHEN** el administrador agrega la palabra objetivo "volcán" a un texto que no la contiene
- **THEN** el sistema rechaza la palabra con un mensaje de validación

#### Scenario: Palabra duplicada
- **WHEN** el administrador agrega "Magma" a una lectura que ya tiene la palabra objetivo "magma"
- **THEN** el sistema rechaza la palabra como duplicada

### Requirement: Cuatro ayudas por palabra objetivo
Cada palabra objetivo SHALL tener exactamente una ayuda de cada tipo: Radicación, Contexto, Sinonimia y Léxico, cada una con contenido no vacío.

#### Scenario: Ayuda faltante
- **WHEN** una palabra objetivo tiene contenido para Radicación, Contexto y Sinonimia, pero no para Léxico
- **THEN** el sistema marca la palabra como incompleta

### Requirement: Opciones de respuesta
Cada palabra objetivo SHALL tener entre 2 y 6 opciones de respuesta, con exactamente una marcada como correcta.

#### Scenario: Sin opción correcta
- **WHEN** el administrador guarda las opciones de una palabra sin marcar ninguna como correcta
- **THEN** el sistema rechaza el guardado

#### Scenario: Dos opciones correctas
- **WHEN** el administrador intenta marcar dos opciones como correctas
- **THEN** el sistema rechaza el guardado

### Requirement: Activación solo de lecturas completas
El administrador SHALL poder activar y desactivar lecturas. El sistema SHALL permitir activar una lectura solo si tiene al menos una palabra objetivo y todas sus palabras tienen las cuatro ayudas y opciones válidas.

#### Scenario: Activar lectura incompleta
- **WHEN** el administrador intenta activar una lectura con una palabra objetivo sin Léxico
- **THEN** el sistema rechaza la activación e indica qué palabra está incompleta

#### Scenario: Desactivar lectura
- **WHEN** el administrador desactiva una lectura activa
- **THEN** la lectura deja de ofrecerse a los participantes y sus resultados registrados se conservan

### Requirement: Contenido evaluado protegido
El sistema SHALL impedir modificar el texto, las palabras objetivo y las opciones de una lectura que ya tiene intentos registrados, para que los resultados existentes sigan siendo coherentes.

#### Scenario: Editar lectura con intentos
- **WHEN** el administrador intenta cambiar el texto de una lectura con intentos registrados
- **THEN** el sistema rechaza el cambio e indica que la lectura ya tiene resultados

### Requirement: Lecturas iniciales
El sistema SHALL incluir una carga inicial con dos lecturas activas y completas para el MVP.

#### Scenario: Instalación nueva
- **WHEN** se inicializa una base de datos vacía con la carga inicial
- **THEN** existen dos lecturas activas, cada una con sus palabras objetivo, cuatro ayudas y opciones
