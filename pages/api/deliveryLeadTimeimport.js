import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";
import { executeQuery } from "../../config/db";

const leadDeliveryTimeImportInCL = () => {
    return new Promise(async (resolve, reject) => {
        helper.logger(
            `Fetching Query For ${process.env.RECORDS_LIMIT} records...`,
            log_color.YELLOW
        );
        let deliveryLeadTimeQry = `SELECT id, COALESCE(customer_availability_desc, website_desc) as shippingMethod, days_min, days_max FROM product_shipping_availability_types WHERE is_enabled = 1 AND days_min IS NOT NULL AND days_max IS NOT NULL LIMIT ${process.env.RECORDS_LIMIT}`;
        let deliveryLeadTimeRes = await executeQuery(deliveryLeadTimeQry, []);
        helper.logger(`${deliveryLeadTimeRes.length} Records fetched.`, log_color.GREEN);
        if (deliveryLeadTimeRes.length > 0) {
            helper.logger(
                `Importing Shipping Methods...`,
                log_color.YELLOW
            );
            for (let dl of deliveryLeadTimeRes) {
                const shippingMethodData = {
                    data: {
                        type: "shipping_methods",
                        attributes: {
                            name: dl.shippingMethod,
                            currency_code: process.env.CL_CURRENCY_CODE,
                            price_amount_cents: 0
                        },
                        relationships: {
                            // shipping_zone: {
                            //     data: {
                            //         type: "shipping_zone",
                            //         id: process.env.CL_SHIPPING_ZONE_ID
                            //     }
                            // },
                            market: {
                                data: {
                                    type: "markets",
                                    id: process.env.CL_MARKET_ID
                                }
                            }
                        }
                    }
                }
                const shippingMethodURL = `${process.env.CL_BASE_ENDPOINT}/api/shipping_methods`;
                fetch(shippingMethodURL, {
                    body: JSON.stringify(shippingMethodData),
                    method: "POST",
                    headers: helper.clAuthHeader(),
                })
                    .then((response) => response.json())
                    .then((data) => {
                        if (data.errors) {
                            helper.logger(data.errors[0].detail, log_color.RED);
                            // process.exit();
                        } else {
                            helper.logger(
                                `${dl.shippingMethod} shipping method has been created.`,
                                log_color.GREEN
                            );
                            const deliveryLeadTimeData = {
                                "data": {
                                    "type": "delivery_lead_times",
                                    "attributes": {
                                        "min_hours": parseInt(dl.days_min) * 24,
                                        "max_hours": parseInt(dl.days_max) * 24
                                    },
                                    "relationships": {
                                        "stock_location": {
                                            "data": {
                                                "type": "stock_locations",
                                                "id": process.env.CL_STOCK_LOCATION_ID
                                            }
                                        },
                                        "shipping_method": {
                                            "data": {
                                                "type": "shipping_methods",
                                                "id": data.data.id
                                            }
                                        }
                                    }
                                }
                            }
                            helper.logger(
                                `Importing Delivery Lead Times...`,
                                log_color.YELLOW
                            );
                            const deliveryLeadTimeURL = `${process.env.CL_BASE_ENDPOINT}/api/delivery_lead_times`;

                            fetch(deliveryLeadTimeURL, {
                                body: JSON.stringify(deliveryLeadTimeData),
                                method: "POST",
                                headers: helper.clAuthHeader(),
                            })
                                .then((response) => response.json())
                                .then((data) => {
                                    if (data.errors) {
                                        helper.logger(data.errors[0].detail, log_color.RED);
                                        // process.exit();
                                    }
                                    helper.logger(
                                        `${data.data.id} delivery lead time has been created.`,
                                        log_color.GREEN
                                    );
                                })
                                .catch((err) => console.error(err));
                        }
                    })

                    .catch((err) => console.error(err));
            }
            resolve(true)
        } else {
            helper.logger(
                `Query returned ${deliveryLeadTimeRes.length} records. Exiting...`,
                log_color.RED
            );
            process.exit();
        }
    });
};

export default async function handler(req, res) {
    try {
        await helper.getCommerceLayerAccessToken();
        helper.logger("Access Token fetched...", log_color.GREEN);
        await leadDeliveryTimeImportInCL().then(async (allSkuData) => {
            res.status(200).json({
                message: "Delivery Lead Time Sync Done Successfully...",
                logs: helper.clImportFinalStatus()
            });
        });
    } catch (error) {
        res.json(error);
        res.status(500).end();
    }
}
