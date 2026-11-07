# Spec Delta

## Purpose

Define cómo se presenta una lectura al participante: la palabra objetivo animada para que siempre sepa sobre qué responde, la imagen que acompaña la lectura, los párrafos del texto y los mínimos visuales de accesibilidad.

## ADDED Requirements

### Requirement: Palabra objetivo en movimiento continuo
Mientras la palabra objetivo actual está sin responder, el sistema SHALL mostrarla resaltada y con una animación sutil que se repite sin detenerse. La animación MUST NOT cambiar la posición del resto del texto. Las palabras objetivo que no son la actual no se animan.

#### Scenario: Palabra sin responder
- **WHEN** se presenta una palabra objetivo y el participante aún no responde
- **THEN** la palabra aparece resaltada en el texto y su animación se repite de forma continua

#### Scenario: Texto estable
- **WHEN** la animación de la palabra objetivo está en curso
- **THEN** ninguna otra palabra del párrafo cambia de posición

#### Scenario: Palabra respondida
- **WHEN** el participante responde la palabra actual
- **THEN** la animación se detiene y la palabra queda resaltada de forma estática mientras se muestra la retroalimentación

### Requirement: Tres variantes de animación alternadas
El sistema SHALL ofrecer tres animaciones distintas para la palabra objetivo y SHALL asignarlas por orden de aparición, de modo que dos palabras consecutivas de una lectura nunca usen la misma.

#### Scenario: Asignación por orden
- **WHEN** una lectura tiene cinco palabras objetivo
- **THEN** las palabras 1 a 5 usan las variantes A, B, C, A y B respectivamente

### Requirement: Movimiento reducido
Cuando el sistema operativo o el navegador piden reducir el movimiento, el sistema MUST NOT mostrar movimiento continuo. La palabra objetivo SHALL seguir distinguiéndose con un estilo estático que no dependa solo del color.

#### Scenario: Preferencia de movimiento reducido
- **WHEN** el participante tiene activada la preferencia de reducir movimiento
- **THEN** la palabra objetivo aparece resaltada y subrayada, sin animación de desplazamiento ni de escala

### Requirement: Imagen de la lectura
Si la lectura tiene imagen, el sistema SHALL mostrarla junto al texto con su texto alternativo. En pantallas de 768 px o más va al costado del inicio del texto; en pantallas más angostas va encima del texto. La imagen MUST NOT tapar el texto y SHALL tener su espacio reservado antes de cargar.

#### Scenario: Pantalla ancha
- **WHEN** un participante abre una lectura con imagen en una pantalla de 1024 px de ancho
- **THEN** la imagen aparece al costado del inicio del texto y el texto la rodea sin superponerse

#### Scenario: Pantalla angosta
- **WHEN** un participante abre una lectura con imagen en una pantalla de 375 px de ancho
- **THEN** la imagen aparece encima del texto, ocupando el ancho disponible, sin desplazamiento horizontal

#### Scenario: Texto alternativo
- **WHEN** se muestra la imagen de una lectura
- **THEN** la imagen tiene como texto alternativo el definido por el administrador

### Requirement: Lectura sin imagen
Si la lectura no tiene imagen, el sistema SHALL mostrar el texto ocupando todo el espacio, sin un hueco ni una imagen de reemplazo.

#### Scenario: Lectura sin imagen
- **WHEN** un participante abre una lectura que no tiene imagen
- **THEN** el texto ocupa todo el ancho de la tarjeta de lectura

### Requirement: Lecturas de varios párrafos
El sistema SHALL mostrar el texto de la lectura respetando sus párrafos. El resaltado de la palabra objetivo SHALL aplicarse en el párrafo donde está su primera aparición.

#### Scenario: Palabra en el segundo párrafo
- **WHEN** la palabra objetivo actual está en el segundo de tres párrafos
- **THEN** el texto se muestra en tres párrafos y la palabra se resalta dentro del segundo

### Requirement: Mínimos visuales de accesibilidad
En todas las pantallas, el sistema SHALL mantener un contraste de al menos 4.5:1 entre el texto y su fondo en tema claro y oscuro, un indicador de foco visible para la navegación con teclado y controles interactivos de al menos 44 × 44 px. Los estados (correcto, incorrecto, activa) MUST NOT comunicarse solo con color.

#### Scenario: Navegación con teclado
- **WHEN** un participante recorre la pantalla de lectura con la tecla Tab
- **THEN** cada control enfocado muestra un indicador de foco visible

#### Scenario: Retroalimentación sin depender del color
- **WHEN** el participante responde mal
- **THEN** la opción elegida y la correcta se distinguen también por un ícono o un texto, no solo por su color
