export type IngredientInput = {
  packagePrice: number;
  packageAmount: number;
  recipeAmount: number;
};

const safeNumber = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export const calculateIngredientCost = ({ packagePrice, packageAmount, recipeAmount }: IngredientInput) => {
  const normalizedAmount = safeNumber(packageAmount);
  if (!normalizedAmount) return 0;
  return (safeNumber(packagePrice) / normalizedAmount) * safeNumber(recipeAmount);
};

export const calculateDrinkEconomics = ({
  ingredientCost,
  wastePercent,
  packagingCost,
  otherVariableCost,
  salePrice,
  targetFoodCostPercent,
}: {
  ingredientCost: number;
  wastePercent: number;
  packagingCost: number;
  otherVariableCost: number;
  salePrice: number;
  targetFoodCostPercent: number;
}) => {
  const adjustedIngredients = safeNumber(ingredientCost) * (1 + Math.max(0, wastePercent) / 100);
  const totalCost = adjustedIngredients + safeNumber(packagingCost) + safeNumber(otherVariableCost);
  const price = safeNumber(salePrice);
  const targetRate = Math.min(100, Math.max(1, targetFoodCostPercent)) / 100;

  return {
    adjustedIngredients,
    totalCost,
    grossProfit: price - totalCost,
    foodCostPercent: price ? (totalCost / price) * 100 : 0,
    markupPercent: totalCost ? ((price - totalCost) / totalCost) * 100 : 0,
    recommendedPrice: totalCost / targetRate,
  };
};

export const calculateBreakEven = ({
  averageCheck,
  checksPerDay,
  workingDays,
  variableCostPercent,
  fixedCosts,
  targetProfit,
}: {
  averageCheck: number;
  checksPerDay: number;
  workingDays: number;
  variableCostPercent: number;
  fixedCosts: number;
  targetProfit: number;
}) => {
  const revenue = safeNumber(averageCheck) * safeNumber(checksPerDay) * safeNumber(workingDays);
  const variableRate = Math.min(0.99, Math.max(0, variableCostPercent / 100));
  const contributionMarginRate = 1 - variableRate;
  const normalizedFixedCosts = safeNumber(fixedCosts);
  const breakEvenRevenue = normalizedFixedCosts / contributionMarginRate;
  const breakEvenChecks = safeNumber(averageCheck) ? breakEvenRevenue / safeNumber(averageCheck) : 0;
  const requiredRevenueForTarget = (normalizedFixedCosts + safeNumber(targetProfit)) / contributionMarginRate;
  const contributionMargin = revenue * contributionMarginRate;
  const operatingProfit = contributionMargin - normalizedFixedCosts;

  return {
    revenue,
    variableRate,
    contributionMarginRate,
    contributionMargin,
    operatingProfit,
    breakEvenRevenue,
    breakEvenChecks,
    breakEvenChecksPerDay: safeNumber(workingDays) ? breakEvenChecks / safeNumber(workingDays) : 0,
    requiredRevenueForTarget,
    safetyMarginPercent: revenue ? ((revenue - breakEvenRevenue) / revenue) * 100 : 0,
  };
};

export const calculateOpeningPlan = ({
  oneTimeCosts,
  contingencyPercent,
  monthlyFixedCosts,
  reserveMonths,
  averageCheck,
  checksPerDay,
  workingDays,
  variableCostPercent,
}: {
  oneTimeCosts: number;
  contingencyPercent: number;
  monthlyFixedCosts: number;
  reserveMonths: number;
  averageCheck: number;
  checksPerDay: number;
  workingDays: number;
  variableCostPercent: number;
}) => {
  const baseInvestment = safeNumber(oneTimeCosts);
  const contingency = baseInvestment * (Math.max(0, contingencyPercent) / 100);
  const workingCapital = safeNumber(monthlyFixedCosts) * Math.max(0, reserveMonths);
  const totalFunding = baseInvestment + contingency + workingCapital;
  const monthly = calculateBreakEven({
    averageCheck,
    checksPerDay,
    workingDays,
    variableCostPercent,
    fixedCosts: monthlyFixedCosts,
    targetProfit: 0,
  });

  return {
    ...monthly,
    baseInvestment,
    contingency,
    workingCapital,
    totalFunding,
    paybackMonths: monthly.operatingProfit > 0 ? totalFunding / monthly.operatingProfit : null,
  };
};
