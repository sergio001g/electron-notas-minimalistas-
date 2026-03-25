# NOTEMA

Aplicación de notas minimalista en Electron con enfoque en escritura, sonido de teclado agradable, panel lateral y herramientas avanzadas de mapas conceptuales.

## Características principales

- **Editor de texto minimalista** con formato básico (negrita, cursiva, subrayado)
- **Mapas conceptuales avanzados** con nodos, conexiones y post-its
- **Sistema de post-its** con múltiples colores (amarillo, rosa, azul, verde, rojo)
- **Cuadrícula configurable** con diferentes colores (negro, azul, verde)
- **Regla inteligente** con ángulos configurables (15°, 45°, 90°, libre)
- **Modo rendimiento** para mejor fluidez en dispositivos lentos
- **Sonido de teclado** opcional
- **Panel lateral** con estadísticas y lista de notas
- **Modo Zen** para escritura sin distracciones

## Cómo ejecutar

1. Instala dependencias:

```
npm install
```

2. Ejecuta la app:

```
npm start
```

## Uso básico

### Editor de texto
- Guardar: Ctrl+S
- Abrir: Ctrl+O
- Negrita: Ctrl+B
- Cursiva: Ctrl+I
- Subrayar: Ctrl+U
- Imprimir / PDF: Ctrl+P
- Panel lateral: Ctrl+\\
- Modo Zen: Ctrl+Shift+Z

### Mapas conceptuales
- Activar tablero: Botón "Mapa / Ideas"
- Agregar cuadro: Botón "+" o menú → Nuevo cuadro
- Agregar post-it: Botón post-it o menú → Nuevo post-it
- Conectar nodos: Seleccionar nodo → Menú → Conectar (C)
- Duplicar: Ctrl+D
- Mover: Arrastrar desde la barra superior del nodo
- Redimensionar: Arrastrar desde esquina inferior derecha

### Herramientas avanzadas
- **Cuadrícula**: Menú → Cuadrícula (Ctrl+G)
- **Regla**: Menú → Regla
- **Ángulos**: Menú → Ángulos (cicla entre 45°, 90°, 15°, libre)
- **Colores post-it**: Menú → Color post-it
- **Colores cuadrícula**: Menú → Color cuadrícula
- **Modo rendimiento**: Menú → Modo rendimiento (Ctrl+M)

## Carpeta de guardado

Los archivos se guardan en:

```
Documentos/NOTEMA
```

## Versión 1.0.1 - Mejoras de rendimiento y personalización

- **Rendimiento optimizado**: Movimiento fluido de post-its y nodos
- **Sistema de colores**: Post-its y cuadrícula con múltiples opciones
- **Ángulos configurables**: Regla con 4 modos de ángulo diferentes
- **Persistencia**: Preferencias guardadas automáticamente
- **Interfaz mejorada**: Menú reorganizado y más intuitivo

## Estructura del proyecto

- `main.js` - Proceso principal de Electron
- `renderer/` - Interfaz de usuario
  - `index.html` - Estructura HTML
  - `styles.css` - Estilos y temas
  - `renderer.js` - Lógica de la aplicación
- `preload.js` - Comunicación segura entre procesos

## Tecnologías utilizadas

- Electron
- HTML5/CSS3/JavaScript vanilla
- localStorage para persistencia
- SVG para conexiones y líneas

## Licencia

ISC