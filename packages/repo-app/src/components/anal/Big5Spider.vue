<template>
  <div class="container mx-auto p-4">
    <!--  
    <h1 class="text-xl font-bold mb-6 text-center">
      Traits de Personnalité Big Five
    </h1>
    -->
    <div id="chart-big-5">
      <apexchart
        type="radar"
        height="450"
        :options="chartOptions"
        :series="chartSeries"
      ></apexchart>
    </div>
  </div>
</template>

<script>
import { defineComponent, computed } from "vue";
import VueApexCharts from "vue3-apexcharts";

export default defineComponent({
	name: "BigFiveSpiderChart",
	components: {
		apexchart: VueApexCharts,
	},
	props: {
		dimensions: {
			type: Object,
			required: true,
			// Expected structure:
			// {
			//   O: { scores: [...], total: number, average: number, label: string, level: string },
			//   C: { scores: [...], total: number, average: number, label: string, level: string },
			//   ...
			// }
		},
	},
	setup(props) {
		// Computed property to transform dimensions data into series format expected by ApexCharts
		const chartSeries = computed(() => {
			return [
				{
					name: "  Score",
					data: Object.keys(props.dimensions).map((key) =>
						Math.round(props.dimensions[key].average * 100),
					),
				},
				{
					name: "Score Moyen",
					data: [50, 50, 50, 50, 50], // Reference point at 50%
				},
			];
		});

		// Computed property for chart options, including dynamic categories from dimensions
		const chartOptions = computed(() => {
			return {
				chart: {
					type: "radar",
					toolbar: {
						show: false,
					},
					fontFamily: "Helvetica, Arial, sans-serif",
				},
				title: {
					text: "  Profil de Personnalité Big Five",
					align: "center",
					style: {
						fontSize: "18px",
						fontWeight: "bold",
					},
				},
				colors: ["#FF6B6B", "#4C86A8"],
				stroke: {
					width: 2,
				},
				fill: {
					opacity: 0.15,
				},
				markers: {
					size: 4,
					hover: {
						size: 6,
					},
				},
				xaxis: {
					categories: Object.keys(props.dimensions).map(
						(key) => props.dimensions[key].label,
					),
					labels: {
						style: {
							fontSize: "14px",
							fontWeight: 500,
						},
					},
				},
				yaxis: {
					min: 0,
					max: 100,
					tickAmount: 5,
				},
				dataLabels: {
					enabled: true,
					background: {
						enabled: true,
						borderRadius: 2,
					},
				},
				legend: {
					position: "bottom",
				},
				tooltip: {
					y: {
						formatter: function (value) {
							return value + "%";
						},
					},
				},
				plotOptions: {
					radar: {
						polygons: {
							strokeColors: "#e9e9e9",
							fill: {
								colors: ["#f8f8f8", "#fff"],
							},
						},
					},
				},
			};
		});

		return {
			chartSeries,
			chartOptions,
		};
	},
});
</script>

<style scoped>
/* Optional custom styles can be added here */
</style>
