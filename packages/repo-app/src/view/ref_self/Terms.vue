<script setup>
import { ref } from "vue";

const effectiveDate = ref("1 mars 2025");
const lastUpdated = ref("17 avril 2025");
const companyName = ref("Technologies Repo.md inc.");
const companyAddress = ref("8428 Henri-Julien, Montréal, Québec, H2T 2A4");
const supportEmail = ref("support@repo.md");

const sections = ref([
	{
		title: "1. Général",
		subsections: [
			{
				content:
					"1.1. Le site Web est conçu pour la fourniture de services de coaching et de fonctionnalités auxiliaires basés sur l'IA via le site Web ou l'application mobile (« Services »).",
			},
			{
				content:
					"1.2. Étant donné que nous utilisons le site Web ou l'application mobile comme principaux outils pour la fourniture de services, le site Web ou l'application mobile propose des fonctionnalités qui facilitent la fourniture de services. Veuillez considérer le site Web ou l'application mobile comme faisant partie de nos Services.",
			},
			{
				content:
					"1.3. Nous nous réservons le droit d'ajouter à tout moment toute nouvelle fonctionnalité au site Web ou à l'application mobile. Si les fonctionnalités nouvellement développées du site Web ne sont pas spécifiquement régies par les Conditions, elles sont fournies « telles quelles » et sont soumises aux Conditions dans la mesure raisonnablement possible.",
			},
			{
				content:
					"1.4. Nous pouvons modifier, suspendre ou interrompre ce site Web, l'application mobile ou les services en tout ou en partie, à tout moment et pour quelque raison que ce soit, sans préavis.",
			},
		],
	},
	{
		title: "2. Admissibilité aux Services",
		subsections: [
			{
				content:
					"2.1. Vous pouvez utiliser le site Web ou l'application mobile et recevoir des services uniquement si vous êtes un particulier et disposez de la pleine capacité juridique pour le faire en vertu des lois de votre résidence. Si vous êtes mineur selon les lois de votre résidence, vous pouvez utiliser le site Web ou l'application mobile et recevoir les services uniquement avec l'approbation de votre parent ou tuteur. Dans ces cas, le parent ou le tuteur est responsable de toutes les activités de l'utilisateur mineur.",
			},
			{
				content:
					"2.2. Les utilisateurs non enregistrés ne peuvent accéder qu'à certaines pages et fonctionnalités du site Web ou de l'application mobile, principalement à des fins d'information telles que la lecture d'un blog, d'une FAQ, de descriptions d'entreprises et d'équipes, d'informations sur les services, les contacts, les liens vers les réseaux sociaux, les commentaires, la définition d'une langue et la soumission d'une candidature pour évaluation.",
			},
		],
	},
	{
		title: "3. Enregistrement du compte utilisateur",
		subsections: [
			{
				content:
					"3.1. Vous pouvez créer un compte utilisateur sur notre site Web.",
			},
			{
				content:
					"3.2. Pour soumettre une candidature, vous devrez peut-être remplir notre formulaire avec vos informations.",
			},
			{
				content:
					"3.3. Le compte utilisateur créé ne peut être utilisé qu'aux fins mentionnées ci-dessus.",
			},
			{
				content:
					"3.4. Vous êtes libre de choisir de soumettre d'autres informations personnelles à votre compte utilisateur.",
			},
			{
				content:
					"3.5. En vous inscrivant sur le site Web, vous déclarez et garantissez que vous :",
				items: [
					"Recevrez les Services conformément aux Conditions et n'utiliserez pas les Services de manière illégale",
					"Fournirez des informations personnelles valides et exactes et les maintiendrez à jour à tout moment",
					"N'accomplirez pas d'actes visant à perturber le fonctionnement normal du site Web",
					"Êtes responsable de la protection de votre compte contre toute utilisation non autorisée",
					"Êtes seul responsable de l'octroi de l'accès à votre compte à des tiers et des conséquences qui en découlent",
					"Ne créerez pas plus d'un compte pour la même personne",
					"N'aurez aucun droit ou avantage sur tout contenu développé par Repo.md sur le site Web",
					"Ne gratterez pas, ne créerez pas de bases de données du contenu fourni sur le site Web",
					"Ne violerez pas nos droits de propriété intellectuelle",
					"Ne violerez pas les droits des autres utilisateurs",
				],
			},
			{
				content:
					"3.6. Nous n'autorisons pas les utilisateurs enregistrés à accorder l'accès à leur compte à d'autres personnes (sauf dans le cas décrit à l'art. 2.1).",
			},
			{
				content:
					"3.7. Vous acceptez de nous informer immédiatement si vous pensez que votre compte utilisateur a été ou peut être utilisé sans votre autorisation.",
			},
			{
				content:
					"3.8. Vous êtes libre de supprimer votre compte à tout moment, s'il n'y a aucune obligation non remplie envers Repo.md.",
			},
		],
	},
	{
		title: "4. Accès aux Services",
		subsections: [
			{
				content:
					"4.1. Après vous être inscrit sur le site Web ou dans l'application mobile et avoir payé des frais d'abonnement, nous changerons de compte utilisateur pour vous donner accès à la gamme complète de fonctionnalités du site Web ou de l'application mobile.",
			},
		],
	},
	{
		title: "5. Prestations",
		subsections: [
			{
				content:
					"5.1. Nous fournissons des services via des sessions de coaching basées sur l'IA (les « sessions »). Les services font référence à un coaching pédagogique basé sur le forfait sélectionné disponible sur le site Web ou dans l'application mobile.",
			},
			{
				content:
					"5.2. Lors de la fourniture des Services, nous pouvons vous recommander d'utiliser des sites Web tiers, des services en ligne, des logiciels ou d'autres produits ou services.",
			},
			{
				content:
					"5.3. Repo.md n'est pas responsable du contenu des produits ou services tiers référencés. Tous les produits ou services tiers sont indépendants de Repo.md.",
			},
			{
				content:
					"5.4. En aucun cas, toute référence à un produit ou service tiers ne doit être interprétée comme une approbation ou une approbation par Repo.md de ce tiers ou de tout produit ou service fourni par un tiers.",
			},
		],
	},
	{
		title: "6. Frais d'abonnement et paiements",
		subsections: [
			{
				content:
					"6.1. Pour la fourniture des Services, vous acceptez de nous payer des frais d'abonnement (les « frais d'abonnement ») qui sont spécifiés sur le site Web.",
			},
			{
				content:
					"6.2. Les frais d'abonnement sont payés en ligne par tout moyen de paiement disponible sur le site Web.",
			},
			{
				content:
					"6.3. Les frais d'abonnement sont payés en totalité avant le début des séances de coaching, hors option d'accès gratuit à une liste limitée de services.",
			},
			{
				content:
					"6.4. Une fois les frais d'abonnement payés, nous vous montrerons une confirmation de paiement.",
			},
			{
				content:
					"6.5. Les abonnements se renouvellent automatiquement en utilisant les informations de paiement enregistrées pour votre compte.",
			},
			{
				content:
					"6.6. Les paiements des abonnements achetés via le Google Play Store et le site Web principal d'Apple sont traités respectivement via les systèmes d'achat de Google et Stripe.",
			},
			{
				content:
					"6.7. Abonnement pour usage personnel. Les abonnements sont destinés et autorisés uniquement à un usage personnel, non transférable et non destiné à la revente.",
			},
			{
				content:
					"6.8. Conditions de renouvellement automatique. En vous abonnant, vous autorisez Repo.md à facturer automatiquement vos frais d'abonnement au début de chaque période de renouvellement.",
			},
			{
				content: "6.9. Annulation d'abonnement",
				subsections: [
					{
						title: "Achats sur le site Web",
						content:
							"Si vous avez acheté un abonnement sur notre site Web, vous pouvez l'annuler à tout moment en contactant l'assistance à " +
							supportEmail.value +
							".",
					},
					{
						title: "Site Web principal (iOS) Achats",
						content:
							"Si vous avez acheté un abonnement via le site Web principal d'Apple, vous pouvez l'annuler en désactivant le renouvellement automatique dans les paramètres de votre compte Apple ID.",
					},
					{
						title: "Achats Google Play (Android)",
						content:
							"Si vous avez acheté un abonnement via Google Play, vous pouvez l'annuler en désactivant le renouvellement automatique dans les paramètres de votre compte Google Play.",
					},
				],
			},
		],
	},
	{
		title: "7. Remboursement",
		subsections: [
			{
				content:
					"7.1. Compte tenu de la nature des services visés par les Conditions, les remboursements ne sont disponibles qu'en cas de trop-payé.",
			},
			{
				content:
					"7.2. Si vous effectuez un trop-payé des frais d'abonnement, le montant du trop-payé ou de la somme remboursée sera remboursé à votre demande.",
			},
			{
				content:
					"7.3. Si vous souhaitez effectuer un remboursement, vous devez nous contacter à l'adresse e-mail " +
					supportEmail.value +
					".",
			},
			{
				content:
					"7.4. La demande doit être envoyée à partir de l'adresse e-mail que vous avez indiquée lors de l'inscription.",
			},
			{
				content:
					"7.5. Vous pouvez annuler votre abonnement à tout moment. En règle générale, il n'y a pas de remboursement partiel ou au prorata en cas d'annulation.",
			},
			{
				content:
					"7.6. Si vous avez acheté votre abonnement via le site Web principal ou Google Play, la gestion des abonnements et les remboursements sont régis par leurs politiques respectives.",
			},
		],
	},
	{
		title: "8. Commentaires",
		subsections: [
			{
				content:
					"8.1. En soumettant des commentaires à des ressources publiques en ligne tierces, vous acceptez que nous soyons libres d'utiliser les commentaires sans aucune compensation supplémentaire pour vous.",
			},
			{
				content:
					"8.2. Vous reconnaissez que nous ne renonçons à aucun droit d'utiliser des idées similaires ou connexes précédemment connues de Repo.md.",
			},
			{
				content:
					"8.3. En soumettant du contenu ou des commentaires dans l'application, vous nous accordez le droit non exclusif et libre de droits d'utiliser, de reproduire et de modifier ce contenu dans le but d'améliorer nos services.",
			},
		],
	},
	{
		title: "9. Propriété intellectuelle",
		subsections: [
			{
				title: "9.1 Notre contenu",
				items: [
					"L'application et son contenu original sont notre propriété",
					"Nos marques, logos et noms sont protégés",
				],
			},
			{
				title: "9.2 Votre contenu",
				items: [
					"Vous conservez vos droits sur votre contenu",
					"Vous nous accordez une licence pour héberger et partager votre contenu",
					"Vous êtes responsable du contenu que vous partagez",
				],
			},
		],
	},
	{
		title: "10. Limitation de responsabilité",
		items: [
			'Le service est fourni "tel quel"',
			"Nous ne garantissons pas la disponibilité continue du service",
			"Nous ne sommes pas responsables des pertes indirectes",
			"Notre responsabilité est limitée au montant payé pour le service",
		],
	},
	{
		title: "11. Loi applicable",
		content:
			"Les lois du Québec régiront le présent Accord. Tout litige sera soumis aux tribunaux compétents du Québec.",
	},
	{
		title: "12. Contact",
		content:
			"Pour toute question concernant ces conditions d'utilisation, contactez-nous à :<br>" +
			supportEmail.value,
	},
]);
</script>

<template>
  <div class="terms-conditions">
    <h1 class="text-2xl font-bold mb-8">Conditions d'utilisation</h1>

    <div class="date mb-8">
      <p class="text-gray-600">
        Date d'entrée en vigueur : {{ effectiveDate }}
      </p>
      <p class="text-gray-600">Dernière mise à jour : {{ lastUpdated }}</p>
    </div>

    <div class="introduction mb-8">
      <p class="text-gray-700">
        Les présentes conditions d'utilisation (les « Conditions », l'« Accord
        ») constituent un contrat juridiquement contraignant entre vous en tant
        qu'utilisateur (« utilisateur », « vous », « votre ») de ce site Web («
        le site Web ») et nous, {{ companyName }}, {{ companyAddress }}, ou
        autre société du groupe (« nous », « Repo.md », « notre »).
      </p>
      <p class="text-gray-700 mt-4">
        Les Conditions régissent vos droits et devoirs concernant l'utilisation
        du site Web et la réception des services. Les utilisateurs et Repo.md
        sont collectivement appelés les Parties et individuellement comme le
        Parti.
      </p>
      <p class="text-gray-700 mt-4">
        En accédant simplement à notre site Web, vous acceptez d'être lié par
        les Conditions dans leur intégralité et sans aucune réserve. Si vous
        n'êtes pas d'accord avec cette obligation, veuillez ne pas utiliser le
        site Web.
      </p>
      <p class="text-gray-700 mt-4">
        Si vous souhaitez savoir comment nous traitons vos données personnelles,
        veuillez consulter notre Politique de confidentialité et notre Politique
        en matière de cookies.
      </p>
    </div>

    <section v-for="(section, index) in sections" :key="index" class="mb-12">
      <h2 class="text-xl font-semibold mb-4">{{ section.title }}</h2>

      <template v-if="section.content">
        <div class="text-gray-700" v-html="section.content"></div>
      </template>

      <template v-if="section.items">
        <ul class="list-disc pl-6 space-y-2">
          <li
            v-for="(item, itemIndex) in section.items"
            :key="itemIndex"
            class="text-gray-700"
          >
            {{ item }}
          </li>
        </ul>
      </template>

      <template v-if="section.subsections">
        <div
          v-for="(subsection, subIndex) in section.subsections"
          :key="subIndex"
          class="mb-6"
        >
          <h3 v-if="subsection.title" class="text-lg font-medium mb-3">
            {{ subsection.title }}
          </h3>

          <div
            v-if="subsection.content"
            class="text-gray-700"
            v-html="subsection.content"
          ></div>

          <ul v-if="subsection.items" class="list-disc pl-6 space-y-2">
            <li
              v-for="(item, itemIndex) in subsection.items"
              :key="itemIndex"
              class="text-gray-700"
            >
              {{ item }}
            </li>
          </ul>

          <div v-if="subsection.subsections" class="ml-4 mt-4">
            <div
              v-for="(nestedSubsection, nestedIndex) in subsection.subsections"
              :key="nestedIndex"
              class="mb-4"
            >
              <h4
                v-if="nestedSubsection.title"
                class="text-base font-medium mb-2"
              >
                {{ nestedSubsection.title }}
              </h4>
              <div
                v-if="nestedSubsection.content"
                class="text-gray-700"
                v-html="nestedSubsection.content"
              ></div>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
  <brochure-footer />
</template>

<style scoped>
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

.terms-conditions h4 {
  color: #34495e;
  font-style: italic;
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
