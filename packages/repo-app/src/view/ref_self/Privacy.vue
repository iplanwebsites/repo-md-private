<script>
export default {
	name: "PrivacyPolicy",
	data() {
		return {
			effectiveDate: "31 janvier 2025",
			sections: [
				{
					title: "1. Introduction",
					content:
						"Bienvenue sur notre application de coaching. La protection de vos renseignements personnels est notre priorité. Cette politique de confidentialité explique comment nous recueillons, utilisons et protégeons vos informations personnelles.",
				},
				{
					title: "2. Informations que nous recueillons",
					subsections: [
						{
							title: "2.1 Informations fournies directement",
							items: [
								"Votre adresse courriel",
								"Les adresses courriel de vos collaborateurs (les personnes que vous encadrez)",
								"Les informations de votre profil",
								"Toute autre information que vous choisissez de partager via notre plateforme",
							],
						},
						{
							title: "2.2 Informations recueillies automatiquement",
							items: [
								"Données d'utilisation via Google Analytics",
								"Informations de connexion et d'authentification via Google Auth",
								"Données de navigation et d'interaction avec l'application",
								"Identifiants d'appareil et adresses IP",
								"Données de performance et de débogage",
							],
						},
					],
				},
				{
					title: "3. Utilisation des informations",
					content:
						"Nous utilisons vos informations pour :<br><br>" +
						"- Fournir et améliorer nos services de coaching<br>" +
						"- Personnaliser votre expérience<br>" +
						"- Communiquer avec vous et vos collaborateurs<br>" +
						"- Assurer la sécurité de notre plateforme<br>" +
						"- Analyser et optimiser les performances de l'application<br>" +
						"- Respecter nos obligations légales",
				},
				{
					title: "4. Partage des informations",
					subsections: [
						{
							title: "4.1 Fournisseurs de services",
							items: [
								"Google Analytics pour l'analyse des données",
								"Supabase pour l'hébergement et la gestion des bases de données",
								"Google Auth pour l'authentification",
								"D'autres outils de surveillance et d'analyse pour assurer le bon fonctionnement de l'application",
							],
						},
						{
							title: "4.2 Exigences légales",
							content:
								"Nous pouvons divulguer vos informations si la loi l'exige ou si nous croyons de bonne foi que cette divulgation est nécessaire pour :<br><br>" +
								"- Respecter une obligation légale<br>" +
								"- Protéger nos droits ou notre propriété<br>" +
								"- Prévenir ou enquêter sur d'éventuelles activités illégales",
						},
					],
				},
				{
					title: "5. Protection des données",
					content:
						"Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos informations, notamment :<br><br>" +
						"- Le chiffrement des données<br>" +
						"- L'authentification sécurisée<br>" +
						"- Les sauvegardes régulières<br>" +
						"- La surveillance continue de la sécurité<br>" +
						"- La formation de notre personnel",
				},
				{
					title: "6. Vos droits",
					content:
						"Vous avez le droit de :<br><br>" +
						"- Accéder à vos données personnelles<br>" +
						"- Corriger vos informations inexactes<br>" +
						"- Demander la suppression de vos données<br>" +
						"- Retirer votre consentement<br>" +
						"- Recevoir une copie de vos données<br>" +
						"- Déposer une plainte auprès des autorités de protection des données",
				},
				{
					title: "7. Conservation des données",
					content:
						"Nous conservons vos informations aussi longtemps que nécessaire pour :<br><br>" +
						"- Fournir nos services<br>" +
						"- Respecter nos obligations légales<br>" +
						"- Résoudre les litiges<br>" +
						"- Faire respecter nos accords",
				},
				{
					title: "8. Modifications de la politique",
					content:
						"Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. Les changements seront publiés sur cette page avec une date de mise à jour. Votre utilisation continue de l'application après ces modifications constitue votre acceptation de la nouvelle politique.",
				},
				{
					title: "9. Nous contacter",
					content:
						"Pour toute question concernant cette politique de confidentialité ou vos données personnelles, veuillez nous contacter à :",
				},
				{
					title: "10. Consentement",
					content:
						"En utilisant notre application, vous consentez à la collecte et à l'utilisation de vos informations conformément à cette politique de confidentialité.",
				},
			],
		};
	},
};
</script>

<template>
  <div class="privacy-policy">
    <h1 class="text-2xl font-bold mb-8">Politique de confidentialité</h1>

    <div class="date mb-8">
      <p class="text-gray-600">
        Date d'entrée en vigueur : {{ effectiveDate }}
      </p>
    </div>

    <section v-for="(section, index) in sections" :key="index" class="mb-12">
      <h2 class="text-xl font-semibold mb-4">{{ section.title }}</h2>
      <div v-if="section.subsections">
        <div
          v-for="(subsection, subIndex) in section.subsections"
          :key="subIndex"
          class="mb-6"
        >
          <h3 class="text-lg font-medium mb-3">{{ subsection.title }}</h3>
          <ul v-if="subsection.items" class="list-disc pl-6 space-y-2">
            <li v-for="(item, itemIndex) in subsection.items" :key="itemIndex">
              {{ item }}
            </li>
          </ul>
          <p v-else class="text-gray-700">{{ subsection.content }}</p>
        </div>
      </div>
      <div v-else>
        <p class="text-gray-700" v-html="section.content"></p>
      </div>
    </section>

    <section class="contact-info mb-8">
      <p class="text-gray-600 italic">[Insérer les coordonnées de contact]</p>
    </section>
  </div>

  <brochure-footer />
</template>

<style>
.privacy-policy {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  line-height: 1.6;
  color: #333;
}

.privacy-policy h1 {
  color: #1a1a1a;
  border-bottom: 2px solid #e5e5e5;
  padding-bottom: 0.5rem;
}

.privacy-policy h2 {
  color: #2c3e50;
}

.privacy-policy h3 {
  color: #34495e;
}

.privacy-policy ul {
  margin-bottom: 1rem;
}

.privacy-policy li {
  margin-bottom: 0.5rem;
}

.privacy-policy p {
  margin-bottom: 1rem;
}
</style>
