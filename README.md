# Marauder UI Pro - Android Edition

## ¿Qué es esto?
Marauder UI Pro es una interfaz gráfica avanzada y moderna diseñada para interactuar con el firmware ESP32 Marauder. Esta versión en específico está preparada como una **Aplicación Nativa para Android**, construida bajo una arquitectura híbrida utilizando Vue.js y Capacitor.

## ¿Cómo funciona?
El proyecto está dividido en dos capas fundamentales que trabajan en conjunto:

1. **Frontend (Web - Vue.js):** Todo lo que ves (los paneles de comandos, el mapa GPS, la interfaz de Wardriving y NFC) está escrito en tecnologías web modernas y vive en la carpeta `src/`.
2. **Capa Nativa (Android - Capacitor):** El código web se empaqueta dentro de un proyecto de Android Studio (carpeta `android/`). Capacitor actúa como el "puente" que permite que tu código web se ejecute como una aplicación instalable real en el celular.

### 🔌 Soporte Serial Nativo (USB OTG)
Uno de los componentes más importantes de este repositorio es su soporte serial. Ya que los navegadores de los celulares Android **no soportan** la *Web Serial API* por defecto, este proyecto incluye **plugins de Java personalizados** (como `MarauderSerialPlugin` y `SerialService`). 

Estos plugins nativos permiten que la aplicación se comunique directamente con el ESP32 a través de un cable **USB OTG**, traduciendo las peticiones de la interfaz web hacia el hardware de forma transparente.

---

## 🛠️ Comandos de Configuración y Compilación

Para compilar y probar este proyecto, necesitas tener instalado **Node.js** y **Android Studio**.

### 1. Instalar Dependencias
Al clonar o abrir este repositorio por primera vez, instala todas las librerías necesarias ejecutando:
```bash
npm install
```

### 2. Construir la Interfaz Visual
Cada vez que hagas un cambio en los archivos `.vue` o `.js` de la carpeta `src/`, debes reconstruir el proyecto de producción:
```bash
npm run build
```

### 3. Sincronizar con Capacitor (Android)
Una vez que el código web está construido, debes "inyectarlo" o sincronizarlo con el proyecto nativo de Android. Ejecuta:
```bash
npx cap sync android
```

### 4. Lanzar la Aplicación
Para abrir el proyecto en Android Studio y compilar tu archivo `.apk`:
```bash
npx cap open android
```
*(Si ya tienes tu celular conectado por USB con el modo de depuración activado, puedes correr la app directamente desde la terminal con `npx cap run android`)*.

## 📖 Documentación Adicional

- [Marauder UI PRO](https://github.com/ElectronicCats/marauder-ui-pro)
- [Firmware PWNterrey](https://github.com/ElectronicCats/pwnterrey-2026_Firmware)
- [Hardware Esquematico](https://github.com/ElectronicCats/badge-pwnterrey-2026)

## 🤝 Contribuciones

Este es un proyecto de hardware abierto. Las contribuciones son bienvenidas:

1. Haz un fork del repositorio.
2. Crea una nueva rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Haz commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Haz push a tu rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto es de hardware abierto. Consulta los archivos de licencia para más detalles.

## 🏢 Electronic Cats

Desarollado con ❤️ por [Electronic Cats](https://www.electroniccats.com/)

<a href="https://github.com/sponsors/ElectronicCats">
<img src="https://electroniccats.com/wp-content/uploads/2020/07/Badge_GHS.png" height="104" />
</a>

Electronic Cats invierte tiempo y recursos en proporcionar este diseño de hardware abierto.
Por favor, apoya a Electronic Cats y al hardware abierto comprando productos de Electronic Cats.

## 📞 Contacto y soporte 

- **Website**: [https://www.electroniccats.com/](https://www.electroniccats.com/)
- **GitHub**: [ElectronicCats](https://github.com/ElectronicCats)
- **Issues**: Usa la sección de Issues en GitHub para reportar problemas o sugerir mejoras

## 🙏 Agradecimientos

Gracias a toda la comunidad de hardware abierto y a todas las personas que hacen posibles proyectos como este.
---
