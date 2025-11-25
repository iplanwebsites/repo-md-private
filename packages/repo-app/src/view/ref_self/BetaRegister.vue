<template>
  <div class="page-container">
    <!-- Airtable Embed Section -->
    <div class="airtable-container mt-8">
      <iframe
        class="airtable-embed"
        src="https://airtable.com/embed/appR09NtKNzotLCl5/shrGQWKs2d47DLqrL"
        frameborder="0"
        @wheel.prevent
        width="100%"
        height="1533"
      ></iframe>
    </div>
  </div>
</template>

<script>
export default {
	name: "TermsAndForm",
	data() {
		return {
			effectiveDate: "31 janvier 2025",
		};
	},
};
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.terms-conditions {
  max-width: 800px;
  margin: 0 auto;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  line-height: 1.6;
  color: #333;
}

.terms-conditions h1 {
  color: #1a1a1a;
  border-bottom: 2px solid #e5e5e5;
  padding-bottom: 0.5rem;
}

.terms-conditions h2 {
  color: #2c3e50;
}

.terms-conditions h3 {
  color: #34495e;
}

.terms-conditions ul {
  margin-bottom: 1rem;
}

.terms-conditions li {
  margin-bottom: 0.5rem;
}

.terms-conditions p {
  margin-bottom: 1rem;
}

.airtable-container {
  border: 1px solid #ccc;
  background: transparent;
  margin: 2rem auto;
  max-width: 800px;
}

.airtable-embed {
  display: block;
  width: 100%;
  height: 1233px;
  background: transparent;
}

@media print {
  .terms-conditions {
    max-width: 100%;
    padding: 0;
  }

  .airtable-container {
    display: none;
  }
}
</style>
