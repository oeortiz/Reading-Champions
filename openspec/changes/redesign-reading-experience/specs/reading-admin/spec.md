# Spec Delta

## MODIFIED Requirements

### Requirement: Gestión de lecturas
El administrador SHALL poder crear, editar y listar lecturas. Cada lectura tiene un título, un texto de uno o más párrafos y una posición que define el orden en que se presenta a los participantes. Los párrafos se separan con una línea en blanco y se conservan al guardar.

#### Scenario: Crear lectura
- **WHEN** el administrador guarda una lectura con título y texto
- **THEN** el sistema la crea en estado inactivo

#### Scenario: Texto de varios párrafos
- **WHEN** el administrador guarda un texto con tres párrafos separados por líneas en blanco
- **THEN** la lectura conserva los tres párrafos y las palabras objetivo se ubican en el texto con los párrafos incluidos

### Requirement: Lecturas iniciales
El sistema SHALL incluir una carga inicial con dos lecturas activas y completas para el MVP: "El espejo de la integridad", con las palabras objetivo acendrado, inmarcesible, ataraxia, inexorable y aquiescencia, y "La biblioteca del barrio". Cada una incluye una imagen con texto alternativo. La lectura "El volcán despierta" deja de formar parte de la carga inicial.

#### Scenario: Instalación nueva
- **WHEN** se inicializa una base de datos vacía con la carga inicial
- **THEN** existen dos lecturas activas, "El espejo de la integridad" en primera posición y "La biblioteca del barrio", cada una con sus palabras objetivo, cuatro ayudas, opciones e imagen

#### Scenario: Base existente sin intentos en la lectura del volcán
- **WHEN** se ejecuta la carga inicial sobre una base que tiene "El volcán despierta" sin intentos registrados
- **THEN** esa lectura se elimina y se agrega "El espejo de la integridad" en primera posición

#### Scenario: Base existente con intentos en la lectura del volcán
- **WHEN** se ejecuta la carga inicial sobre una base que tiene "El volcán despierta" con intentos registrados
- **THEN** esa lectura se desactiva conservando sus resultados, y se agrega "El espejo de la integridad" en primera posición

## ADDED Requirements

### Requirement: Imagen de la lectura
El administrador SHALL poder subir, reemplazar y quitar una imagen por lectura, con texto alternativo obligatorio. El sistema SHALL aceptar solo PNG, JPEG o WebP de hasta 1 MB, verificando el contenido real del archivo. La imagen no forma parte del contenido evaluado: se puede cambiar aunque la lectura tenga intentos o esté activa.

#### Scenario: Subir imagen válida
- **WHEN** el administrador sube un JPEG de 300 KB con el texto alternativo "Un espejo antiguo"
- **THEN** la lectura queda con esa imagen y ese texto alternativo

#### Scenario: Formato no permitido
- **WHEN** el administrador sube un archivo SVG, GIF o un archivo con extensión .png cuyo contenido no es una imagen PNG
- **THEN** el sistema rechaza la imagen indicando los formatos aceptados

#### Scenario: Imagen demasiado grande
- **WHEN** el administrador sube una imagen de más de 1 MB
- **THEN** el sistema rechaza la imagen indicando el tamaño máximo

#### Scenario: Sin texto alternativo
- **WHEN** el administrador sube una imagen sin texto alternativo
- **THEN** el sistema rechaza la imagen y pide el texto alternativo

#### Scenario: Lectura con resultados
- **WHEN** el administrador reemplaza la imagen de una lectura activa que tiene intentos registrados
- **THEN** el sistema acepta el cambio y los participantes ven la imagen nueva

#### Scenario: Quitar imagen
- **WHEN** el administrador quita la imagen de una lectura
- **THEN** la lectura queda sin imagen y se presenta sin hueco

### Requirement: La imagen no es requisito para activar
El sistema SHALL permitir activar una lectura completa aunque no tenga imagen.

#### Scenario: Activar sin imagen
- **WHEN** el administrador activa una lectura completa que no tiene imagen
- **THEN** la lectura se activa
