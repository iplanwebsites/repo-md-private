import { ref, onMounted, onUnmounted } from 'vue'

export function useTypewriter(words = [], options = {}) {
  const {
    typingSpeed = 100,
    deletingSpeed = 50,
    pauseDuration = 2000
  } = options

  const typewriterText = ref('')
  const currentWordIndex = ref(0)
  const currentCharIndex = ref(0)
  const isDeleting = ref(false)
  let typewriterInterval = null

  const typeWriterEffect = () => {
    if (words.length === 0) return
    
    const currentWord = words[currentWordIndex.value]
    
    if (isDeleting.value) {
      // Deleting characters
      typewriterText.value = currentWord.substring(0, currentCharIndex.value - 1)
      currentCharIndex.value--
      
      if (currentCharIndex.value === 0) {
        isDeleting.value = false
        currentWordIndex.value = (currentWordIndex.value + 1) % words.length
        // Restart interval with typing speed
        clearInterval(typewriterInterval)
        typewriterInterval = setInterval(typeWriterEffect, typingSpeed)
      }
    } else {
      // Typing characters
      typewriterText.value = currentWord.substring(0, currentCharIndex.value + 1)
      currentCharIndex.value++
      
      if (currentCharIndex.value === currentWord.length) {
        // Pause before deleting
        clearInterval(typewriterInterval)
        setTimeout(() => {
          isDeleting.value = true
          typewriterInterval = setInterval(typeWriterEffect, deletingSpeed)
        }, pauseDuration)
      }
    }
  }

  const startTypewriter = () => {
    if (words.length > 0) {
      typewriterText.value = ''
      currentWordIndex.value = 0
      currentCharIndex.value = 0
      isDeleting.value = false
      typewriterInterval = setInterval(typeWriterEffect, typingSpeed)
    }
  }

  const stopTypewriter = () => {
    if (typewriterInterval) {
      clearInterval(typewriterInterval)
      typewriterInterval = null
    }
  }

  onMounted(() => {
    startTypewriter()
  })

  onUnmounted(() => {
    stopTypewriter()
  })

  return {
    typewriterText,
    startTypewriter,
    stopTypewriter
  }
}