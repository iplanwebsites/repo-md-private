<script setup>
// PROPS
const { message, buttonText } = defineProps({
	message: {
		type: String,
		default: "Are you sure you want to leave this meeting?",
	},
	buttonText: {
		type: String,
		default: "Leave Meeting",
	},
});

const emit = defineEmits(["confirm"]);

function handleClick() {
	emit("confirm");
}
</script>
<template>
  <!-- Leave Meeting Button with Confirmation Dialog -->
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <slot></slot>
    </AlertDialogTrigger>

    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ buttonText }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ message }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="handleClick">
          {{ buttonText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
