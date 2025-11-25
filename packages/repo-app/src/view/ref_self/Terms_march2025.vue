<script>
export default {
	name: "TermsConditions",
	data() {
		return {
			effectiveDate: "31 janvier 2025",
			sections: [
				{
					title: "1. Acceptation des conditions",
					content:
						"En accédant et en utilisant cette application de coaching, vous acceptez d'être lié par ces conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application.",
				},
				{
					title: "2. Description du service",
					content:
						"Notre application offre une plateforme de coaching en ligne permettant :<br><br>" +
						"- La gestion des relations coach-client<br>" +
						"- Le suivi des progrès<br>" +
						"- La communication entre coachs et clients<br>" +
						"- Le partage de ressources et de documents",
				},
				{
					title: "3. Inscription et compte",
					subsections: [
						{
							title: "3.1 Création de compte",
							items: [
								"Vous devez fournir des informations exactes et complètes",
								"Vous êtes responsable de maintenir la confidentialité de votre mot de passe",
								"Vous devez avoir l'âge légal pour utiliser ce service",
								"Une adresse courriel valide est requise",
							],
						},
						{
							title: "3.2 Comptes professionnels (Coachs)",
							items: [
								"Vous devez être qualifié pour offrir des services de coaching",
								"Vous êtes responsable de vérifier les qualifications requises dans votre juridiction",
								"Vous devez maintenir des standards professionnels appropriés",
							],
						},
					],
				},
				{
					title: "4. Utilisation acceptable",
					subsections: [
						{
							title: "4.1 Vous acceptez de",
							items: [
								"Respecter toutes les lois applicables",
								"Protéger la confidentialité de vos clients",
								"Maintenir des interactions professionnelles et respectueuses",
								"Sauvegarder vos données importantes",
							],
						},
						{
							title: "4.2 Vous ne devez pas",
							items: [
								"Harceler ou intimider d'autres utilisateurs",
								"Partager des contenus inappropriés ou illégaux",
								"Tenter de compromettre la sécurité du système",
								"Utiliser le service pour des activités frauduleuses",
							],
						},
					],
				},
				{
					title: "5. Propriété intellectuelle",
					subsections: [
						{
							title: "5.1 Notre contenu",
							items: [
								"L'application et son contenu original sont notre propriété",
								"Nos marques, logos et noms sont protégés",
							],
						},
						{
							title: "5.2 Votre contenu",
							items: [
								"Vous conservez vos droits sur votre contenu",
								"Vous nous accordez une licence pour héberger et partager votre contenu",
								"Vous êtes responsable du contenu que vous partagez",
							],
						},
					],
				},
				{
					title: "6. Paiements et abonnements",
					subsections: [
						{
							title: "6.1 Tarification",
							items: [
								"Les prix sont affichés en devise locale",
								"Nous pouvons modifier les prix avec préavis",
								"Les taxes applicables seront ajoutées",
							],
						},
						{
							title: "6.2 Renouvellement et annulation",
							items: [
								"Les abonnements se renouvellent automatiquement",
								"Vous pouvez annuler à tout moment",
								"Les remboursements suivent notre politique spécifique",
							],
						},
					],
				},
				{
					title: "7. Limitation de responsabilité",
					items: [
						'Le service est fourni "tel quel"',
						"Nous ne garantissons pas la disponibilité continue du service",
						"Nous ne sommes pas responsables des pertes indirectes",
						"Notre responsabilité est limitée au montant payé pour le service",
					],
				},
				{
					title: "8. Confidentialité et données",
					items: [
						"Nous protégeons vos informations selon notre politique de confidentialité",
						"Vous êtes responsable des données de vos clients",
						"Nous suivons les réglementations en matière de protection des données",
					],
				},
				{
					title: "9. Résiliation",
					subsections: [
						{
							title: "9.1 Par l'utilisateur",
							items: [
								"Vous pouvez résilier votre compte à tout moment",
								"Vous devez sauvegarder vos données avant la résiliation",
							],
						},
						{
							title: "9.2 Par nous",
							items: [
								"Nous pouvons suspendre ou résilier les comptes qui violent ces conditions",
								"Nous vous notifierons de toute action contre votre compte",
							],
						},
					],
				},
				{
					title: "10. Modifications des conditions",
					items: [
						"Nous pouvons modifier ces conditions à tout moment",
						"Les modifications prennent effet dès leur publication",
						"L'utilisation continue constitue l'acceptation des nouvelles conditions",
					],
				},
				{
					title: "11. Loi applicable",
					items: [
						"Ces conditions sont régies par les lois du Québec",
						"Tout litige sera soumis aux tribunaux compétents du Québec",
					],
				},
				{
					title: "12. Contact",
					content:
						"Pour toute question concernant ces conditions d'utilisation, contactez-nous à :<br><br>" +
						"[Insérer les coordonnées de contact]",
				},
			],
		};
	},
};
</script>

<template>
  <div class="terms-conditions">
    <h1 class="text-2xl font-bold mb-8">Conditions d'utilisation</h1>

    <div class="date mb-8">
      <p class="text-gray-600">
        Date d'entrée en vigueur : {{ effectiveDate }}
      </p>
    </div>

    <section v-for="(section, index) in sections" :key="index" class="mb-12">
      <h2 class="text-xl font-semibold mb-4">{{ section.title }}</h2>

      <template v-if="section.content">
        <div class="text-gray-700" v-html="section.content"></div>
      </template>

      <template v-if="section.subsections">
        <div
          v-for="(subsection, subIndex) in section.subsections"
          :key="subIndex"
          class="mb-6"
        >
          <h3 class="text-lg font-medium mb-3">{{ subsection.title }}</h3>

          <template v-if="subsection.items">
            <ul class="list-disc pl-6 space-y-2">
              <li
                v-for="(item, itemIndex) in subsection.items"
                :key="itemIndex"
                class="text-gray-700"
              >
                {{ item }}
              </li>
            </ul>
          </template>

          <template v-if="subsection.content">
            <div class="text-gray-700" v-html="subsection.content"></div>
          </template>
        </div>
      </template>
    </section>

    <section class="contact-info mb-8">
      <p class="text-gray-600 italic">[Insérer les coordonnées de contact]</p>
    </section>
  </div>

  <brochure-footer />
</template>

<style>
.terms-conditions {
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

@media print {
  .terms-conditions {
    max-width: 100%;
    padding: 0;
  }
}
</style>
