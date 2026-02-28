(() => {
  const currencyFormatter = new Intl.NumberFormat("ja-JP");

  const elements = {
    faceValue: document.getElementById("faceValue"),
    saleValue: document.getElementById("saleValue"),
    nominalRate: document.getElementById("nominalRate"),
    inflationRate: document.getElementById("inflationRate"),
    maxYears: document.getElementById("maxYears"),
    errorMessage: document.getElementById("errorMessage"),
    lossValue: document.getElementById("lossValue"),
    growthFactorValue: document.getElementById("growthFactorValue"),
    realYieldValue: document.getElementById("realYieldValue"),
    breakevenValue: document.getElementById("breakevenValue"),
    nominalAtNValue: document.getElementById("nominalAtNValue"),
    realAtNValue: document.getElementById("realAtNValue"),
    pnlAtNValue: document.getElementById("pnlAtNValue"),
    chartNote: document.getElementById("chartNote"),
    chartCanvas: document.getElementById("trendChart")
  };

  let trendChart;

  function fmtYen(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return `${currencyFormatter.format(Math.round(value))}円`;
  }

  function fmtSignedYen(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    const rounded = Math.round(value);
    const prefix = rounded > 0 ? "+" : "";
    return `${prefix}${currencyFormatter.format(rounded)}円`;
  }

  function fmtPct(rateDecimal) {
    if (!Number.isFinite(rateDecimal)) {
      return "-";
    }
    return `${(rateDecimal * 100).toFixed(2)}%`;
  }

  function fmtYear(years) {
    if (!Number.isFinite(years)) {
      return "-";
    }
    return `${years.toFixed(2)}年`;
  }

  function readInputs() {
    return {
      F: Number(elements.faceValue.value),
      S: Number(elements.saleValue.value),
      rPct: Number(elements.nominalRate.value),
      iPct: Number(elements.inflationRate.value),
      N: Number(elements.maxYears.value)
    };
  }

  function validateInputs(values) {
    const { F, S, rPct, iPct, N } = values;

    if (![F, S, rPct, iPct, N].every((value) => Number.isFinite(value))) {
      return "すべての入力欄に数値を入力してください。";
    }

    if (F <= 0 || S <= 0) {
      return "額面 F と売却金額 S は 0 より大きい値を入力してください。";
    }

    if (rPct <= -100 || iPct <= -100) {
      return "名目年利 r とインフレ率 i は -100% より大きい値を入力してください。";
    }

    if (N < 0 || N > 100 || !Number.isInteger(N)) {
      return "グラフ表示年数上限 N は 0〜100 の整数で入力してください。";
    }

    return "";
  }

  function calculate(values) {
    const { F, S, rPct, iPct, N } = values;
    const r = rPct / 100;
    const i = iPct / 100;
    const g = (1 + r) / (1 + i);
    const L = F - S;

    const years = Array.from({ length: N + 1 }, (_, index) => index);
    const seriesP = years.map((n) => S * Math.pow(g, n) - F);
    const seriesReal = years.map((n) => S * Math.pow(g, n));
    const seriesNominal = years.map((n) => S * Math.pow(1 + r, n));

    let breakeven = {
      kind: "exists",
      n: 0,
      ceilYear: 0,
      message: ""
    };

    if (S >= F) {
      breakeven = {
        kind: "zero",
        n: 0,
        ceilYear: 0,
        message: "0年（売却時点で損失なし）"
      };
    } else if (g <= 1) {
      breakeven = {
        kind: "never",
        n: Number.POSITIVE_INFINITY,
        ceilYear: null,
        message: "黒字化しない（∞）"
      };
    } else {
      const nStar = Math.log(F / S) / Math.log(g);
      breakeven = {
        kind: "exists",
        n: nStar,
        ceilYear: Math.ceil(nStar),
        message: `約${fmtYear(nStar)}（切り上げ ${Math.ceil(nStar)}年）`
      };
    }

    return {
      F,
      S,
      r,
      i,
      N,
      g,
      L,
      years,
      seriesP,
      seriesReal,
      seriesNominal,
      breakeven,
      nominalAtN: seriesNominal[seriesNominal.length - 1],
      realAtN: seriesReal[seriesReal.length - 1],
      pnlAtN: seriesP[seriesP.length - 1]
    };
  }

  function resetOutputsForError() {
    const outputIds = [
      "lossValue",
      "growthFactorValue",
      "realYieldValue",
      "breakevenValue",
      "nominalAtNValue",
      "realAtNValue",
      "pnlAtNValue"
    ];

    outputIds.forEach((id) => {
      elements[id].textContent = "-";
    });

    elements.chartNote.textContent = "入力値が有効になると、ここに損益分岐の注記を表示します。";

    if (trendChart) {
      trendChart.data.datasets = [];
      trendChart.update();
    }
  }

  function updateResultView(calcResult) {
    elements.lossValue.textContent = fmtSignedYen(calcResult.L);
    elements.growthFactorValue.textContent = `${calcResult.g.toFixed(4)}倍`;
    elements.realYieldValue.textContent = fmtPct(calcResult.g - 1);
    elements.breakevenValue.textContent = calcResult.breakeven.message;
    elements.nominalAtNValue.textContent = fmtYen(calcResult.nominalAtN);
    elements.realAtNValue.textContent = fmtYen(calcResult.realAtN);
    elements.pnlAtNValue.textContent = fmtSignedYen(calcResult.pnlAtN);
  }

  function createChartIfNeeded() {
    if (trendChart) {
      return;
    }

    trendChart = new Chart(elements.chartCanvas, {
      type: "line",
      data: {
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: "nearest",
          intersect: false
        },
        scales: {
          x: {
            type: "linear",
            title: {
              display: true,
              text: "年数"
            },
            ticks: {
              precision: 0
            }
          },
          y: {
            title: {
              display: true,
              text: "実質損益（円）"
            },
            ticks: {
              callback(value) {
                return fmtYen(Number(value));
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              boxWidth: 12
            }
          },
          tooltip: {
            callbacks: {
              label(context) {
                if (context.dataset.label === "損益分岐") {
                  return `損益分岐: ${fmtYear(context.parsed.x)}`;
                }
                return `${context.dataset.label}: ${fmtSignedYen(context.parsed.y)}`;
              }
            }
          }
        }
      }
    });
  }

  function updateChart(calcResult) {
    createChartIfNeeded();

    const pnlPoints = calcResult.years.map((year, index) => ({
      x: year,
      y: calcResult.seriesP[index]
    }));

    const zeroLinePoints = [
      { x: 0, y: 0 },
      { x: calcResult.N, y: 0 }
    ];

    const datasets = [
      {
        label: "実質損益 P(n)",
        data: pnlPoints,
        borderColor: "#0f766e",
        backgroundColor: "rgba(15, 118, 110, 0.2)",
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.2
      },
      {
        label: "損益ゼロライン",
        data: zeroLinePoints,
        borderColor: "#8f98ab",
        borderDash: [6, 6],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0
      }
    ];

    if (calcResult.breakeven.kind === "exists" && calcResult.breakeven.n <= calcResult.N) {
      datasets.push({
        label: "損益分岐",
        data: [{ x: calcResult.breakeven.n, y: 0 }],
        type: "scatter",
        showLine: false,
        pointRadius: 6,
        pointHoverRadius: 8,
        backgroundColor: "#f97316"
      });
      elements.chartNote.textContent = `損益分岐は約 ${fmtYear(calcResult.breakeven.n)}（切り上げ ${calcResult.breakeven.ceilYear}年）です。`;
    } else if (calcResult.breakeven.kind === "never") {
      elements.chartNote.textContent = "実質成長倍率 g が 1 以下のため、この条件では黒字化しません。";
    } else if (calcResult.breakeven.kind === "zero") {
      elements.chartNote.textContent = "売却時点ですでに額面以上のため、損益分岐は 0 年です。";
    } else {
      elements.chartNote.textContent = `損益分岐は約 ${fmtYear(calcResult.breakeven.n)}で、表示範囲（0〜${calcResult.N}年）外です。`;
    }

    trendChart.options.scales.x.max = calcResult.N;
    trendChart.options.scales.x.min = 0;
    trendChart.options.scales.x.ticks.stepSize = Math.max(1, Math.ceil(calcResult.N / 10));
    trendChart.data.datasets = datasets;
    trendChart.update();
  }

  function render() {
    const values = readInputs();
    const validationError = validateInputs(values);

    if (validationError) {
      elements.errorMessage.textContent = validationError;
      resetOutputsForError();
      return;
    }

    elements.errorMessage.textContent = "";
    const calcResult = calculate(values);
    updateResultView(calcResult);
    updateChart(calcResult);
  }

  Object.values(elements)
    .filter((element) => element instanceof HTMLInputElement)
    .forEach((input) => {
      input.addEventListener("input", render);
    });

  render();
})();
