import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";

export default async function handler(req, res) {
  try {
    await helper.getCommerceLayerAccessToken();
    helper.logger("Access Token fetched...", log_color.GREEN);
    // const orgUrl = `${process.env.CL_BASE_ENDPOINT}/api/organization`;
    // helper.logger("orgUrl...", log_color.YELLOW);
    // await fetch(orgUrl, {
    //   method: "GET",
    //   headers: helper.clAuthHeader(),
    // })
    //   .then((response) => response.json())
    //   .then(async (data) => {
    //     if(data.errors) {
    //         helper.logger(data.errors[0].detail, log_color.RED);
    //         res
    //               .status(parseInt(data.errors[0].status))
    //               .json({ error: data.errors[0].detail });
    //               process.exit()
    //     }
    //     console.log(JSON.stringify(data))
    //     process.exit()
    //   })    
    let allSKUs = [];
    let allPrices = [];
    let allStockItems = [];
    for (let i = 1; i <= 2; i++) {
    //   let currentSKU =
    //     "Product" +
    //     Math.floor(Math.random() * 100001) +
    //     Math.random()
    //       .toString(36)
    //       .substring(2, 8 + 2);
          let currentSKU = 'Product3105h15104gt';
      allSKUs.push({
        code: currentSKU,
        name: currentSKU,
        image_url:
          "https://do6sydhp1s299.cloudfront.net/web/files/collections/63407d13a9fd36.74667349.png",
        reference: `Ref-${currentSKU}`,
        shipping_category_id: process.env.CL_SHIPPING_CATEGORY_ID,
        description: "<ul><li>Quickly and safely cleans Optics</li><li>Pre-moistened</li><li>Ammonia-free formula is safe for Anti-Reflective Coating</li><li>Individually wrapped</li></ul>",
       });
      allPrices.push({
        currency_code: "USD",
        sku_code: currentSKU,
        amount_cents: Math.floor(Math.random() * 1001),
        compare_at_amount_cents: Math.floor(Math.random() * 1001),
      });
      allStockItems.push({
        sku_code: currentSKU,
        quantity: Math.floor(Math.random() * 101),
      });
    }
    //   SKU IMPORT
    const skuData = {
      data: {
        type: "imports",
        attributes: {
          resource_type: "skus",
          inputs: allSKUs,
        },
      },
    };
    const priceData = {
      data: {
        type: "imports",
        attributes: {
          resource_type: "prices",
          format: "json",
          parent_resource_id: process.env.CL_PRICE_LIST_ID,
          inputs: allPrices,
        },
      },
    };
    const stockItemsData = {
      data: {
        type: "imports",
        attributes: {
          resource_type: "stock_items",
          format: "json",
          parent_resource_id: process.env.CL_STOCK_LOCATION_ID,
          inputs: allStockItems,
        },
      },
    };
    //   IMPORTING ALL SKUs
    const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
    helper.logger("Importing all SKUs...", log_color.YELLOW);
    await fetch(skuAPIUrl, {
      body: JSON.stringify(skuData),
      method: "POST",
      headers: helper.clAuthHeader(),
    })
      .then((response) => response.json())
      .then(async (data) => {
        if(data.errors) {
            helper.logger(data.errors[0].detail, log_color.RED);
            res
                  .status(parseInt(data.errors[0].status))
                  .json({ error: data.errors[0].detail });
                  process.exit()
        }
        helper.logger("All SKUs has been imported.", log_color.GREEN);
      })
      .catch((err) => console.error(err));
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
