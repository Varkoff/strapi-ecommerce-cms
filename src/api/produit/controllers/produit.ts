/**
 * produit controller
 */

import { type Core, factories } from "@strapi/strapi";
import type { ExtendableContext } from "koa";
import Stripe from "stripe";
import { z } from "zod";
import { io } from "../../..";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
});

const eventSchema = z
    .enum(["entry.update", "entry.create", "entry.delete"])
    .or(z.string());

const ProductSchema = z.object({
    documentId: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.number(),
});

const ProductWebhookSchema = z.object({
    event: eventSchema,
    uid: z.literal("api::produit.produit"),
    entry: ProductSchema,
});

const OrderSchema = z.object({
    documentId: z.string(),
});

const OrderWebhookSchema = z.object({
    event: eventSchema,
    uid: z.literal("api::commande.commande"),
    entry: OrderSchema,
});

export default factories.createCoreController(
    "api::produit.produit",
    ({ strapi }) => ({
        async findOne(ctx) {
            const { slug } = ctx.params;
            // const sanitizedQueryParams = await this.sanitizeQuery(ctx);
            const entity = await strapi.db.query("api::produit.produit").findOne({
                where: {
                    slug,
                },
                populate: {
                    image: {
                        fields: ["url", "width", "height", "alternativeText"],
                    },
                    categories: {
                        fields: ["name"],
                    },
                },
            });

            const sanitizedEntity = await this.sanitizeOutput(entity, ctx);

            return this.transformResponse(sanitizedEntity);
        },

        async updateStripeProducts(ctx) {
            try {
                // @ts-ignore
                if (ctx.request.body.uid === "api::produit.produit") {
                    return await manageStripeProducts({ ctx, strapi });
                }

                // @ts-ignore
                if (ctx.request.body.uid === "api::commande.commande") {
                    return await createStripeCheckout({ ctx, strapi });
                }
            } catch (err) {
                console.error(err);
                throw err;
            }
        },
        async handleStripeWebhooks(ctx) {
            const sig = ctx.request.headers["stripe-signature"];
            // @ts-ignore
            const raw = ctx.request.body[Symbol.for("unparsedBody")];
            console.log({ sig, raw });

            let event: Stripe.Event;

            try {
                // @ts-ignore
                event = stripe.webhooks.constructEvent(
                    raw,
                    sig,
                    process.env.STRIPE_WEBHOOK_SECRET_KEY,
                );
            } catch (err) {
                console.error(err.message);
                // response.status(400).send(`Webhook Error: ${err.message}`);
                return;
            }

            // Handle the event
            switch (event.type) {
                case "payment_intent.succeeded":
                    {
                        console.log(event.data.object.metadata)
                        const orderId = Number(event.data.object.metadata.orderId);

                        const existingOrder = await strapi.db
                            .query("api::commande.commande")
                            .findOne({
                                where: {
                                    id: orderId,
                                },
                                populate: {
                                    user: {
                                        fields: ["email"],
                                    },
                                },
                            });

                        await strapi.db.query("api::commande.commande").update({
                            where: {
                                id: orderId,
                            },
                            data: {
                                orderStatus: "payé",
                            },
                        });

                        await strapi.plugins.email.services.email.send({
                            to: existingOrder.user.email,
                            from: "Strapi Ecommerce <no-reply@strapi.algomax.fr>",
                            replyTo: "contact@algomax.fr",
                            subject: "Merci pour votre commande !",
                            text: `Merci d'avoir commandé ! Retrouvez les informations de votre commande à cette adresse : ${process.env.FRONTEND_URL}/orders/${existingOrder.documentId}`,
                            html: `Merci d'avoir commandé ! Retrouvez les informations de votre commande à cette adresse : ${process.env.FRONTEND_URL}/orders/${existingOrder.documentId}`,
                        });
                        // Then define and call a function to handle the event payment_intent.succeeded
                        break;
                    }
                // ... handle other event types
                default:
                    console.log(`Unhandled event type ${event.type}`);
            }

            return { status: "ok" };
        },
    }),
);

const manageStripeProducts = async ({
    ctx,
}: {
    ctx: ExtendableContext;
    strapi: Core.Strapi;
}) => {
    // @ts-ignore
    const data = ProductWebhookSchema.parse(ctx.request.body);

    if (data.event !== "entry.update" && data.event !== "entry.create") {
        return;
    }

    // console.log({ NODE_ENV: process.env.NODE_ENV });

    const existingProduct = await strapi.db
        .query("api::produit.produit")
        .findOne({
            where: {
                documentId: data.entry.documentId,
            },
            populate: {
                image: {
                    fields: ["url", "width", "height", "alternativeText"],
                },
                // categories: {
                //     fields: ['name']
                // }
            },
        });

    // console.log(existingProduct)
    const doesNotHaveProductInProduction =
        !existingProduct.stripeProductId && process.env.NODE_ENV === "production";
    const doestNotHaveProductInDev =
        !existingProduct.devStripeProductId &&
        process.env.NODE_ENV !== "production";

    const doesNotHaveProduct =
        doesNotHaveProductInProduction || doestNotHaveProductInDev;

    if (doesNotHaveProduct) {
        const stripeProduct = await stripe.products.create({
            name: existingProduct.name,
            description: existingProduct.description,
            default_price_data: {
                currency: "eur",
                unit_amount: existingProduct.price * 100,
            },
            images: existingProduct.image
                ? [`${process.env.STRAPI_URL}/${existingProduct.image.url}`]
                : [],
        });

        await strapi.db.query("api::produit.produit").updateMany({
            where: {
                documentId: existingProduct.documentId,
            },
            data:
                process.env.NODE_ENV === "production"
                    ? {
                        stripeProductId: stripeProduct.id,
                    }
                    : {
                        devStripeProductId: stripeProduct.id,
                    },
        });
    } else {
        const stripeProductId =
            process.env.NODE_ENV === "production"
                ? existingProduct.stripeProductId
                : existingProduct.devStripeProductId;

        const stripeProduct = await stripe.products.retrieve(stripeProductId);

        const stripePrice = await stripe.prices.create({
            currency: "eur",
            unit_amount: existingProduct.price * 100,
            active: true,
            product: stripeProduct.id,
        });
        await stripe.products.update(stripeProduct.id, {
            name: existingProduct.name,
            description: existingProduct.description,
            default_price: stripePrice.id,
            images: existingProduct.image
                ? [`${process.env.STRAPI_URL}/${existingProduct.image.url}`]
                : [],
        });

        await stripe.prices.update(stripeProduct.default_price as string, {
            active: false,
        });
    }
    // await strapi.db.query.update(produt)
    return {
        status: " success",
    };
};

const createStripeCheckout = async ({
    ctx,
}: {
    ctx: ExtendableContext;
    strapi: Core.Strapi;
}) => {
    // @ts-ignore
    const data = OrderWebhookSchema.parse(ctx.request.body);

    if (data.event !== "entry.create") {
        return;
    }
    const { entry } = data;

    const existingOrder = await strapi.db
        .query("api::commande.commande")
        .findOne({
            where: {
                documentId: entry.documentId,
            },
            populate: {
                user: {
                    fields: ["email"],
                },
                lines: {
                    fields: ["quantity", "price"],
                    populate: {
                        produit: {
                            fields: [
                                "name",
                                "price",
                                "stripeProductId",
                                "devStripeProductId",
                            ],
                        },
                    },
                },
            },
        });

    const products = existingOrder.lines.map((l) => l.produit);

    const stripeProductIds = products
        .map((product) => {
            if (process.env.NODE_ENV === "production") {
                return product.stripeProductId as string;
            }
            return product.devStripeProductId as string;
        })
        .filter(Boolean);

    const stripeProduct = await stripe.products.list({
        ids: stripeProductIds,
    });

    const productPricesAndQuantities: { price: string; quantity: number }[] =
        stripeProduct.data.map((sp) => {
            const lineItem = existingOrder.lines.find((l) =>
                process.env.NODE_ENV === "production"
                    ? l.produit.stripeProductId === sp.id
                    : l.produit.devStripeProductId === sp.id,
            );

            if (!lineItem) {
                throw new Error(`Did not find line item for product ${sp.id}`);
            }

            return {
                price: sp.default_price as string,
                quantity: lineItem.quantity,
            };
        });

    const session = await stripe.checkout.sessions.create({
        line_items: productPricesAndQuantities,
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL}/orders/${existingOrder.documentId}?success=true`,
        cancel_url: `${process.env.FRONTEND_URL}/orders/${existingOrder.documentId}?canceled=true`,
        automatic_tax: { enabled: true },
        currency: "eur",

        metadata: {
            orderId: existingOrder.id,
        },
        customer_email: existingOrder.user.email,
        payment_intent_data: {
            metadata: {
                orderId: existingOrder.id,
            },
        },
    });

    io.to(existingOrder.user.id).emit("checkout", session.url);
    await strapi.plugins.email.services.email.send({
        to: existingOrder.user.email,
        from: "Strapi Ecommerce <no-reply@strapi.algomax.fr>",
        replyTo: "contact@algomax.fr",
        subject: `Votre commande #${existingOrder.id}`,
        text: `Merci pour votre commande. Veuillez la payer à l'adresse suivante : ${session.url}`,
        html: `Merci pour votre commande. Veuillez la payer à l'adresse suivante : ${session.url}`,
    });

    // pour envoyer une notif au frontend avec l'URL de redirection
    // envoyer un mail au client avec lien de paiement
};
