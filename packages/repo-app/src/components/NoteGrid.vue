<script setup>
import {
	defineProps,
	defineEmits,
	ref,
	onBeforeUnmount,
	watch,
	reactive,
	computed,
} from "vue";

const props = defineProps({
	gridNotes: {
		type: Array,
		required: true,
	},
	gridNotesDetails: {
		type: Array,
		required: true,
	},
	activeNotes: {
		type: Array,
		default: () => [],
	},

	displayedLabel: {
		type: String,
		default: "noteName", //"pitchClass",
	},
	isInteractive: {
		type: Boolean,
		default: true,
	},
	scalePitchClasses: {
		type: Array,
		default: () => [],
	},
	rootNote: {
		type: Object,
		default: () => ({
			name: "C",
			num: 0,
			pitchClass: 0,
			noteColor: "#f44336",
		}),
	},
});
import { getLabelColorForBackground } from "@/lib/colorUtils.js";
import { rgb } from "color-convert";

const emit = defineEmits(["noteOn", "noteOff"]);

const clickedNote = ref(null);
const touchedNotes = reactive(new Set());

// Handling mouse down for notes
const handleMouseDown = (note) => {
	if (clickedNote.value !== note) {
		if (clickedNote.value) emit("noteOff", clickedNote.value);
		clickedNote.value = note;
		emit("noteOn", note);
	}
};

// Handling mouse up for notes
const handleMouseUp = () => {
	if (clickedNote.value) {
		emit("noteOff", clickedNote.value);
		clickedNote.value = null;
	}
};

// Modify touch handlers to prevent default
const handleTouchStart = (note, event) => {
	console.log("handleTouchStart", note, event);

	event.preventDefault(); // Prevent the mouse event
	touchedNotes.add(note);
	emit("noteOn", note);
};

const handleTouchEnd = (note, event) => {
	console.log("handleTouchEnd", note, event);
	event.preventDefault(); // Prevent the mouse event
	touchedNotes.delete(note);
	emit("noteOff", note);
};

// Cleanup on component unmount
onBeforeUnmount(() => {
	if (clickedNote.value) emit("noteOff", clickedNote.value);
	clickedNote.value = null;
	touchedNotes.forEach((note) => emit("noteOff", note));
	touchedNotes.clear();
});

const activePitchClasses = computed(() =>
	props.activeNotes.map((note) => note % 12),
);

function getAngledSquareClassBasedOnLocation(row, col) {
	// we want to have angle around the 8x8 center.
	// sor pos 4,4 = angled bl.
	const specialPositions = [
		[3, 3, "angle-br"],
		[3, 4, "angle-bl"],
		[4, 3, "angle-tr"],
		[4, 4, "angle-tl"],
	];
	//check if there's a match, return class or empty string.
	return specialPositions.find((pos) => pos[0] === row && pos[1] === col)?.[2];
}

const getNoteClass = (note, row, col) => {
	// Get the angled corner class based on the row and col values
	const angledClass = getAngledSquareClassBasedOnLocation(row, col);

	return {
		// "is-in-scale": note.isInScale,
		//isInScale: note.isInScale,

		// "border ": note.isInScale,

		//notInScale: !note.isInScale,
		//pitchActive: activePitchClasses.value.includes(note.num % 12),
		//  || note.num === note.pitchClass ||
		//touchedNotes.has(note.pitchClass),
		active:
			props.activeNotes.includes(note.num) ||
			note.num === clickedNote.value ||
			touchedNotes.has(note.num),
		// Dynamically add the angled corner class if it exists
		[angledClass]: angledClass !== undefined,
	};
};

// Global handlers for managing mouse and touch events outside the component
const globalMouseUp = () => {
	handleMouseUp();
	touchedNotes.forEach((note) => {
		emit("noteOff", note);
	});
	touchedNotes.clear();
};

watch(clickedNote, (newVal) => {
	if (newVal) {
		window.addEventListener("mouseup", globalMouseUp);
		//  window.addEventListener("touchend", globalMouseUp);
	} else {
		window.removeEventListener("mouseup", globalMouseUp);
		//  window.removeEventListener("touchend", globalMouseUp);
	}
});

// Convert RGB to HSL
// Convert hex to RGB
function hexToRgb(hex) {
	// Remove the hash if it's there
	hex = hex.replace(/^#/, "");

	// Parse the hex string
	let bigint = parseInt(hex, 16);
	let r = (bigint >> 16) & 255;
	let g = (bigint >> 8) & 255;
	let b = bigint & 255;

	return [r, g, b];
}

// Convert RGB to HSL
function rgbToHsl(r, g, b) {
	(r /= 255), (g /= 255), (b /= 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h,
		s,
		l = (max + min) / 2;

	if (max === min) {
		h = s = 0; // achromatic
	} else {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return [h * 360, s * 100, l * 100];
}

// Adjust lightness
function adjustLightness(hsl, percent) {
	let [h, s, l] = hsl;
	l = Math.max(0, Math.min(100, l * (1 + percent / 100)));
	return `hsl(${Math.round(h) || 0}, ${Math.round(s) || 0}%, ${Math.round(l) || 0}%)`;
}

// Generate gradient CSS
function getBgCss(color) {
	let rgbColor;

	if (typeof color === "string") {
		// Check if it's a hex color
		if (color.startsWith("#") || color.length === 6 || color.length === 3) {
			rgbColor = hexToRgb(color);
		} else {
			// Assume it's comma-separated RGB values
			rgbColor = color.split(",").map((val) => parseInt(val.trim(), 10));
		}
	} else if (Array.isArray(color)) {
		rgbColor = color;
	} else {
		throw new Error(`Invalid color format. Received: ${JSON.stringify(color)}`);
	}

	if (
		rgbColor.length !== 3 ||
		!rgbColor.every(
			(n) => typeof n === "number" && !isNaN(n) && n >= 0 && n <= 255,
		)
	) {
		console.log(
			`Invalid RGB values. Each value must be a number between 0 and 255. Received: ${JSON.stringify(rgbColor)}`,
			color,
			rgbColor,
		);
		/*
    throw new Error(
      `Invalid RGB values. Each value must be a number between 0 and 255. Received: ${JSON.stringify(rgbColor)}`
    );*/
	}

	const percentChangeLightness = 10;
	const hsl = rgbToHsl(...rgbColor);

	const slightlyLighter = adjustLightness(hsl, percentChangeLightness);
	const slightlyDarker = adjustLightness(hsl, -percentChangeLightness);
	const normalColor = `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;

	return `linear-gradient(180deg, ${slightlyLighter} 0%, ${normalColor} 50%, ${slightlyDarker} 100%)`;
}

// Test the function
function testGradient(input) {
	try {
		console.log("Input:", input);
		const result = getBgCss(input);
		console.log("Result:", result);
	} catch (error) {
		console.error("Error:", error.message);
	}
}
/*
// Test cases
testGradient("#6496C8"); // Hex color
testGradient([100, 150, 200]); // RGB array
testGradient("100, 150, 200"); // RGB string
testGradient("#FF"); // Invalid hex (should fail)
testGradient("not a color"); // Invalid input (should fail)
// Example usage with an RGB array
const baseColorRgb = [107, 16, 0]; // Ensure this is an array
console.log(getBgCss(baseColorRgb));
// Example usage
const color = "#3498db"; // Some blue
alert(getBgCss(color));

*/
</script>

<template>
  <!--  demo  
  <div class="box angle-bl"></div>
  <div class="box angle-br"></div>
  <div class="box angle-tl"></div>
  <div class="box angle-tr"></div>
  -->
  <div class="note-grid">
    <div
      v-for="(row, rowIndex) in gridNotesDetails"
      :key="rowIndex"
      class="note-row"
    >
      <div
        v-for="(note, colIndex) in row"
        :key="colIndex"
        class="note noise-background50"
        @mousedown="handleMouseDown(note.num)"
        @mouseup="handleMouseUp(note.num)"
        @touchstart="(event) => handleTouchStart(note.num, event)"
        @touchend="(event) => handleTouchEnd(note.num, event)"
        :style="{ background: getBgCss(note.currentColor) }"
        :class="getNoteClass(note, rowIndex, colIndex)"
      >
        <!-- 
 :style="{ backgroundColor: note.currentColor }"

          :style="{ backgroundColor: note.currentColor }"
          
       :class="getNoteClass(note, rowIndex, colIndex)"
       
     :style="{ backgroundColor: note.noteColor }"
               {{ note.isMicNote }}
    -->
        <div
          class="note-info"
          :class="{
            isRoot: note.isRoot,
            isMicNote: note.isMicNote,
            isChordButton: note.isChordButton,
          }"
          :style="{ color: getLabelColorForBackground(note.currentColor) }"
        >
          {{ note.label }}
          <span v-if="note.isRoot">
            <strong> </strong>

            <!--● -   〇 ⭕
            ●●●●●○◒◌○◍◎⊗☢〇⊖❍⦿🔘⊝⊜⊛⊚◦∘⊕⚪⚫🔴⊗⊙◕◑
            🎤
            ⭕🔴🟡🟣
            
            -->
          </span>

          <span v-else>
            <!--  
            <span v-if="note.isMicNote"> {{ note.label }} 🤘 </span>

            <span v-else> {{ note.label }} </span>
            -->
          </span>

          <!-- 
          pitchClassLetterFancy
                 {{ note.emoji }}
           {{ note.num }} -  -
          {{ note.pitchClassLetter }}
        {{ note.pitchClass }}.. {{ note.name }} - {{ note.num }} -
        {{ note.pitchClass }}
        <span class="emoji" v-if="note.isInScale">
          {{ note.emoji }} {{ note.pitchName }}
        </span>
         -->
        </div>
      </div>
    </div>

    <!-- 
  <hr />
  <br /><br />
  {{ touchedNotes }} == touchedNotes <br />
  {{ clickedNote }} == clickedNote

   -->
  </div>
</template>

<style>
:root {
  --angle-size: 20%; /* Adjust this value for the relative corner cut size */
  --activeNoteColor: #f44336;
  --activeNoteColorGlow: #ff9d41;
  --activeOctaveColor: #fffcbe;

  --cell-size: 100px; /* Default size */
}
/*
@media (max-width: 1010px) {
  :root {
    --cell-size: 70px;
  }
}

@media (max-width: 780px) {
  :root {
    --cell-size: 60px;
  }
}
*/
@media (min-height: 1000px) and (min-width: 1300px) {
  :root {
    --cell-size: 100px; /* Smaller cells on larger screens */
  }
}

#background-video {
  width: 100vw;
  height: 100vh;
  object-fit: cover;
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: -1;
}

/* Bottom-left corner cut */
.angle-bl {
  clip-path: polygon(
    0 0,
    100% 0,
    100% 100%,
    var(--angle-size) 100%,
    0 calc(100% - var(--angle-size))
  );
}

/* Bottom-right corner cut */
.angle-br {
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - var(--angle-size)),
    calc(100% - var(--angle-size)) 100%,
    0 100%
  );
}

/* Top-left corner cut */
.angle-tl {
  clip-path: polygon(
    var(--angle-size) 0,
    100% 0,
    100% 100%,
    0 100%,
    0 var(--angle-size)
  );
}

/* Top-right corner cut */
.angle-tr {
  clip-path: polygon(
    0 0,
    calc(100% - var(--angle-size)) 0,
    100% var(--angle-size),
    100% 100%,
    0 100%
  );
}
.note-grid {
  /*
  display: flex;
  flex-direction: column;
  gap: 2px;
  user-select: none;
  */
  padding-top: 0;
  opacity: 0.8;
  /*
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj4KICA8ZmlsdGVyIGlkPSJub2lzZSIgeD0iMCUiIHk9IjAlIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICAgIDxmZVR1cmJ1bGVuY2UgdHlwZT0iZnJhY3RhbE5vaXNlIiBiYXNlRnJlcXVlbmN5PSIxLjUiIG51bU9jdGF2ZXM9IjEiIHN0aXRjaFRpbGVzPSJub1N0aXRjaCIgcmVzdWx0PSJub2lzeSIvPgogICAgPGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPgogICAgPGZlQ29tcG9uZW50VHJhbnNmZXI+CiAgICAgIDxmZUZ1bmNBIHR5cGU9ImxpbmVhciIgc2xvcGU9IjAuNSIvPiAgPCEtLSBBZGp1c3Qgc2xvcGUgZm9yIG9wYWNpdHkgLS0+CiAgICA8L2ZlQ29tcG9uZW50VHJhbnNmZXI+CiAgPC9maWx0ZXI+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI25vaXNlKSIgZmlsbD0id2hpdGUiLz4KPC9zdmc+IA==);

*/
}

.note-row {
  display: flex;
  justify-content: center;
  align-content: center;
  align-items: center;
}

.note {
  padding: 10px;
  margin: 0.15vw;
  border: 1px solid #ccc;
  border-color: hsl(var(--border));
  width: var(--cell-size);
  cursor: pointer;
  text-align: center;
  user-select: none;
  /* disable select. */
  border-radius: 2px;

  display: flex;
  align-items: center; /* Centers vertically */
  justify-content: center; /* Centers horizontally, remove this line if not needed */
  transition: background-color 1.1s ease-out; /* Slow fade out */
  aspect-ratio: 1 / 1; /* Keeps the cell square */

  background: linear-gradient(180deg, #ffffff, #efefef);
  background: linear-gradient(180deg, #ff6262, #ff0000, #8a0000);
  background: linear-gradient(180deg, #000000 2%, #ff0000 56%, #00cc49 97%);
  border: 2px solid #000000;
  border-color: hsl(0deg 0% 79.99%);
  border-color: hsl(var(--background));
  border-radius: 8px;
  /*
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  */
  transition: all 0.2s ease-out;
}

.note:hover {
  border-color: hsl(var(--border)) !important;
  color: #333;
}

.note:hover .note-info {
  opacity: 0.6;
  line-height: 0;
}

.note-info {
  opacity: 0.2;
}

.note-info.isRoot,
.note-info.isChordButton {
  opacity: 0.8;
}

.note-info.isMicNote {
  opacity: 0.8;
  background: #a8ff8f;
}

.note.active {
  background-color: #777;
  opacity: 1;
  transition: background-color 0.2s ease-out; /* Quick punch in */
  /*
  border-color: hsl(var(--primary)) !important;
  */
}

.note:hover {
  /* ... existing styles ... */
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
}

.note.active {
  background-color: #777;
  opacity: 1;
  transform: translateY(1px);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.2),
    0 1px 2px rgba(0, 0, 0, 0.1);

  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.note.active,
.note.notInScale.active,
.note.pitchActive.active {
  /*
  background-color: var(
    --activeNoteColor
  ) !important; 
*/

  color: white;
  opacity: 1;
  /* create yellow glow css
  box-shadow: 0 0 2px 2px var(--activeNoteColorGlow);
   */
}

.note.isInScale {
  /*
  background-color: #2affd1 !important;  */
}
.note.notInScale {
  background-color: #f7f7f7 !important; /* Highlight active notes */
  color: hsl(var(--secondary-foreground));
  background-color: hsl(var(--secondary)) !important;
}
.note.pitchActive,
.note.notInScale.pitchActive:not(.active) {
  background-color: var(
    --activeOctaveColor
  ) !important; /* Highlight active notes */
  color: hsl(var(--secondary-foreground));
  opacity: 1;
}

.note.isInScale .infos {
  opacity: 1;
}

/* Rounded corner styles */
.rounded-bl-md {
  border-bottom-left-radius: 20px;
}

.rounded-br-md {
  border-bottom-right-radius: 20px;
}

.rounded-tl-md {
  border-top-left-radius: 20px;
}

.rounded-tr-md {
  border-top-right-radius: 20px;
}
</style>
