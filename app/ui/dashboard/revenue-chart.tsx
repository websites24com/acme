import { Revenue } from '@/app/lib/definitions';
import { fetchRevenue } from '@/app/lib/data';


export default async function RevenueChart() {
  
  const revenue = await fetchRevenue(); // Fetch data inside the component
  console.log('DEBUG Revenue:', revenue);
  const chartHeight = 350;

  if (!revenue || revenue.length === 0) {
    console.log('Revenue is empty.');
    return <p className="mt-4 text-gray-400">No data available.</p>;
  }

  console.log('Revenue has length:', revenue.length);

  // TEST: REMOVE generateYAxis TEMPORARILY
  // const { yAxisLabels, topLabel } = generateYAxis(revenue);

  return (
    <div className="w-full md:col-span-4">
      <h2 className="mb-4 text-xl md:text-2xl">
        Recent Revenue
      </h2>

      <div className="rounded-xl bg-gray-50 p-4">
        <div className="sm:grid-cols-13 mt-0 grid grid-cols-12 items-end gap-2 rounded-md bg-white p-4 md:gap-4">
          {revenue.map((month) => (
            <div key={month.month} className="flex flex-col items-center gap-2">
              <div
                className="w-full rounded-md bg-blue-300"
                style={{
                  height: `100px`, // hardcoded for now
                }}
              ></div>
              <p className="-rotate-90 text-sm text-gray-400 sm:rotate-0">
                {month.month}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center pb-2 pt-6">
          <h3 className="ml-2 text-sm text-gray-500">Last 12 months</h3>
        </div>
      </div> 
    </div>
  );
}
