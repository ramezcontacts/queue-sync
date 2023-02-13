import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";
import commercelayerjsAuth from "@commercelayer/js-auth";


const getCommerceLayerSalesChannelAccessToken = async () => {
    try {
        helper.logger("Fetching Access Token...", log_color.YELLOW);
        helper.logger(
            `Executing Function => getCommerceLayerSalesChannelAccessToken`,
            log_color.BLUE
        );
        const { accessToken } = await commercelayerjsAuth.getSalesChannelToken({
            clientId: "G6_HdW__2kvm7XDT99lG538G9UqGfVV-Ucm0pvqqcjI",
            endpoint: process.env.CL_BASE_ENDPOINT,
            scope: "market:12245"
        });
        return accessToken;
    } catch (err) {
        throw err;
    }
};

export default async function handler(req, res) {
    try {
        const skuID = "ZbpjSNqLok";
        //   IMPORTING ALL SKUs
        const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/skus/${skuID}?include=delivery_lead_times`;
        const accessToken = await getCommerceLayerSalesChannelAccessToken();
        helper.logger("Access Token fetched...", log_color.GREEN);
        console.log(accessToken)
        helper.logger(`Fetching a sku with id = ${skuID}`, log_color.YELLOW);
        await fetch(skuAPIUrl, {
            method: "GET",
            headers: {
                Accept: "application/vnd.api+json",
                Authorization: `Bearer ${accessToken}`
            }
        }).then((response) => {
            console.log(response);//process.exit();
            return response.json()
        }).catch((err) => console.error(err))
            .then(async (data) => {
                console.log(data)
                if (data.errors) {
                    helper.logger(data.errors[0].detail, log_color.RED);
                    res
                        .status(parseInt(data.errors[0].status))
                        .json({ error: data.errors[0].detail });
                    process.exit()
                }
                res.json({ records: data });
                helper.logger("Sku fetched.", log_color.GREEN);
            })
            .catch((err) => console.error(err));
    } catch (error) {
        console.error(error);
        res.json(error);
        res.status(500).end();
    }
}