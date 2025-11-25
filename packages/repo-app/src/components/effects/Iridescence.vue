<template>
  <div ref="ctnDom" class="iridescence-container" v-bind="attrs" />
</template>

<script setup>
import {
	ref,
	onMounted,
	onUnmounted,
	watch,
	computed,
	useAttrs,
	defineOptions,
} from "vue";
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";

// Disable automatic attribute inheritance
defineOptions({
	inheritAttrs: false,
});

// Props with default values
const props = defineProps({
	color: {
		type: Array,
		default: () => [1, 1, 1],
	},
	speed: {
		type: Number,
		default: 1.0,
	},
	amplitude: {
		type: Number,
		default: 0.1,
	},
	mouseReact: {
		type: Boolean,
		default: true,
	},
});

// Shaders
const vertexShader = `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0, 1);
  }
  `;

const fragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uResolution;
  uniform vec2 uMouse;
  uniform float uAmplitude;
  uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    float mr = min(uResolution.x, uResolution.y);
    vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;
    // Add a subtle offset based on the mouse position
    uv += (uMouse - vec2(0.5)) * uAmplitude;
    float d = -uTime * 0.5 * uSpeed;
    float a = 0.0;
    for (float i = 0.0; i < 8.0; ++i) {
      a += cos(i - d - a * uv.x);
      d += sin(uv.y * i + a);
    }
    d += uTime * 0.5 * uSpeed;
    vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
    col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
    gl_FragColor = vec4(col, 1.0);
  }
  `;

// Refs
const ctnDom = ref(null);
const mousePos = ref({ x: 0.5, y: 0.5 });

// Get attributes excluding props
const attrs = useAttrs();

// Variables for cleanup
let renderer, gl, program, mesh, animateId;

// Methods
const resize = () => {
	if (!ctnDom.value || !renderer || !program) return;

	const ctn = ctnDom.value;
	const scale = 1;
	renderer.setSize(ctn.offsetWidth * scale, ctn.offsetHeight * scale);

	program.uniforms.uResolution.value = new Color(
		gl.canvas.width,
		gl.canvas.height,
		gl.canvas.width / gl.canvas.height,
	);
};

const handleMouseMove = (e) => {
	const rect = ctnDom.value.getBoundingClientRect();
	const x = (e.clientX - rect.left) / rect.width;
	const y = 1.0 - (e.clientY - rect.top) / rect.height;
	mousePos.value = { x, y };

	if (program) {
		program.uniforms.uMouse.value[0] = x;
		program.uniforms.uMouse.value[1] = y;
	}
};

const update = (t) => {
	animateId = requestAnimationFrame(update);
	if (program) {
		program.uniforms.uTime.value = t * 0.001;
	}
	if (renderer && mesh) {
		renderer.render({ scene: mesh });
	}
};

const setup = () => {
	if (!ctnDom.value) return;

	const ctn = ctnDom.value;
	renderer = new Renderer();
	gl = renderer.gl;
	gl.clearColor(1, 1, 1, 1);

	// Initial resize
	resize();

	const geometry = new Triangle(gl);
	program = new Program(gl, {
		vertex: vertexShader,
		fragment: fragmentShader,
		uniforms: {
			uTime: { value: 0 },
			uColor: { value: new Color(...props.color) },
			uResolution: {
				value: new Color(
					gl.canvas.width,
					gl.canvas.height,
					gl.canvas.width / gl.canvas.height,
				),
			},
			uMouse: { value: new Float32Array([mousePos.value.x, mousePos.value.y]) },
			uAmplitude: { value: props.amplitude },
			uSpeed: { value: props.speed },
		},
	});

	mesh = new Mesh(gl, { geometry, program });

	// Start animation
	animateId = requestAnimationFrame(update);

	// Append canvas to container
	ctn.appendChild(gl.canvas);

	// Add event listeners
	window.addEventListener("resize", resize, false);

	if (props.mouseReact) {
		ctn.addEventListener("mousemove", handleMouseMove);
	}
};

const cleanup = () => {
	if (animateId) {
		cancelAnimationFrame(animateId);
	}

	window.removeEventListener("resize", resize);

	if (props.mouseReact && ctnDom.value) {
		ctnDom.value.removeEventListener("mousemove", handleMouseMove);
	}

	if (
		ctnDom.value &&
		gl &&
		gl.canvas &&
		gl.canvas.parentNode === ctnDom.value
	) {
		ctnDom.value.removeChild(gl.canvas);
	}

	if (gl) {
		const loseContext = gl.getExtension("WEBGL_lose_context");
		if (loseContext) {
			loseContext.loseContext();
		}
	}
};

onMounted(() => {
	setup();
});

onUnmounted(() => {
	cleanup();
});

// Watch for props changes
watch(
	() => [props.color, props.speed, props.amplitude, props.mouseReact],
	() => {
		cleanup();
		setup();
	},
);
</script>

<style scoped>
/* Add your CSS here if needed */
.iridescence-container {
  width: 100%;
  height: 100%;
}
</style>
