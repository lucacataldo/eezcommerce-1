require("dotenv").config();

// dependencies
const express = require("express");
var app = express();
var sessions = require("client-sessions");
var fs = require("fs");
var bodyParser = require("body-parser");
var exphbs = require("express-handlebars");
var hbHelpers = require("handlebars-helpers")();
var path = require("path");
var multer = require("multer");
var jimp = require("jimp");

// custom modules
const mailService = require("./modules/emailService.js");
const userService = require("./modules/userService.js");
const categoryService = require("./modules/categoryService.js");
const productService = require("./modules/productService.js");
const orderService = require("./modules/orderService");
const customizationService = require("./modules/customizationService");
const industryModel = require("./modules/Models/IndustryModel");
const Cart = require("./modules/Models/Cart");

var simpleGuard = require("./modules/simpleGuard.js");

if (process.env.DEV_MODE !== "true") {
	simpleGuard(app, "foremile", "super secret string", 20);
}

// express middlewares & setup

const imageStorage = multer.diskStorage({
	destination: function(req, file, cb) {
		cb(null, "public/siteData/" + req.auth.userDetails._id + "/img/");
	},
	filename: function(req, file, cb) {
		cb(null, "Image" + path.extname(file.originalname));
	}
});
const avatarStorage = multer.diskStorage({
	destination: function(req, file, cb) {
		var dir = "public/siteData/" + req.auth.userDetails._id + "/img/avatar";
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		cb(null, "public/siteData/" + req.auth.userDetails._id + "/img/avatar/");
	},
	filename: function(req, file, cb) {
		cb(null, "avatar");
	}
});

const featureStorage = multer.diskStorage({
	destination: function(req, file, cb) {
		var dir = "public/siteData/" + req.auth.userDetails._id + "/img/feature";
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		cb(null, dir);
	},
	filename: function(req, file, cb) {
		req.hadFile = true;
		cb(null, "feature");
	}
});

const uploadImg = new multer({
	storage: imageStorage,
	limits: { fileSize: 1 * 4096 * 4096 }, // 16mb max file size
	fileFilter: function(req, file, callback) {
		var ext = path.extname(file.originalname);
		if (ext !== ".png" && ext !== ".jpg" && ext !== ".gif" && ext !== ".jpeg") {
			return callback(new Error("Only images are allowed"));
		}
		callback(null, true);
	}
});

var uploadAvatar = new multer({
	storage: avatarStorage,
	limits: { fileSize: 1 * 4096 * 4096 }, // 16mb max file size
	fileFilter: function(req, file, callback) {
		var ext = path.extname(file.originalname);
		if (ext !== ".png" && ext !== ".jpg" && ext !== ".gif" && ext !== ".jpeg") {
			return callback(new Error("Only images are allowed"));
		}
		callback(null, true);
	}
});

const uploadFeatureImage = new multer({
	storage: featureStorage,
	limits: { fileSize: 1 * 4096 * 4096 }, // 16mb max file size
	fileFilter: function(req, file, callback) {
		var ext = path.extname(file.originalname);
		if (ext !== ".png" && ext !== ".jpg" && ext !== ".gif" && ext !== ".jpeg") {
			req.imgError = "Only .png, .jpg & .gif are allowed.";
		}
		callback(null, true);
	}
});

// Sets the express view engine to use handlebars (file endings in .hbs), registers helpers
app.engine(
	".hbs",
	exphbs({
		extname: ".hbs",
		helpers: hbHelpers
	})
);

app.set("view engine", ".hbs");

// creates a static server on the "public directory" (kinda like an apache server)
app.use(express.static("public"));

// sets up the session cookie for authorization
app.use(
	sessions({
		cookieName: "auth",
		secret: process.env.SESSION_SECRET,
		duration: 1 * 1 * 60 * 1000, // HH * MM * SS * MS | fill with ones to the left
		activeDuration: 1 * 60 * 60 * 1000
	})
);

app.use(
	sessions({
		cookieName: "senecaAuth",
		secret: process.env.SESSION_SECRET,
		duration: 1 * 1 * 60 * 1000, // HH * MM * SS * MS | fill with ones to the left
		activeDuration: 1 * 60 * 60 * 1000
	})
);
// Shopping cart cookie
app.use(
	sessions({
		cookieName: "shoppingCart",
		secret: "shoppingcart secret",
		duration: 7 * 24 * 60 * 60 * 1000
	})
);

// these two statements allow us to take data from a POST and use it (its available via req.body)
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

//console.logs any unhandled rejections (mainly for unhandled promises)
process.on("unhandledRejection", error => {
	// Will print "unhandledRejection err is not defined"
	console.log("unhandledRejection", error);
});

// protecting the /dashboard route (and subroutes) only be available if logged in
app.use("/dashboard", (req, res, next) => {
	if (req.auth.isLoggedIn) {
		req.auth.userDetails.avatarExists = fs.existsSync(
			"public/siteData/" + req.auth.userDetails._id + "/img/avatar/avatar"
		);
		next();
	} else {
		res.status(403).send("403 Unauthorized <a href='/'>home</a>");
	}
});

/* 




	ROUTES keyword: k.get
 		->	GET 	Place all GET routes here





*/

app.get("/", (req, res) => {
	res.render("home", { layout: "NavBar", pagename: "home" });
});

app.get("/forgot", (req, res) => {
	res.render("ForgottenPassword", { layout: "NavBar" });
});
app.get("/terms", (req, res) => {
	res.render("terms", { layout: "NavBar" });
});

app.get("/all-sites", (req, res) => {
	userService
		.getAllBasic()
		.then(result => {
			res.json(result);
		})
		.catch(err => {
			res.json({ error: err });
		});
});

app.get("/verify_email/:email/:token", (req, res) => {
	let token = req.params.token;
	let email = req.params.email;

	userService
		.verifyEmail(token, email)
		.then(() => {
			try {
				req.auth.userDetails.isVerified = true;
			} catch (error) {
				console.log(error);
			}
			res.render("EmailVerified", { layout: "NavBar" });
		})
		.catch(error => {
			console.log(error);
			res.json(error);
		});
});

app.get("/reset_password/:email/:token", (req, res) => {
	let token = req.params.token;
	let email = req.params.email;

	userService
		.validateToken(token, email)
		.then(() => {
			res.render("changePassword", { layout: "NavBar", token: token, email: email });
		})
		.catch(() => {
			res.send("Invalid token");
		});
});

app.get("/testimonials", (req, res) => {
	res.render("testimonials", { layout: "NavBar" });
});

app.get("/email-reset-sent", (req, res) => {
	res.render("EmailResetSent", { layout: "NavBar" });
});

app.get("/email-verification-sent", (req, res) => {
	res.render("EmailVerificationSent", { layout: "NavBar" });
});

/* 


Dashboard routes keywords k.dash

*/

app.get("/dashboard", (req, res) => {
	res.redirect("/dashboard/overview");
});
app.get("/dashboard/overview", async (req, res) => {
	let topSellers = [];
	try {
		topSellers = await productService.getTopSellers(req.auth.userDetails._id);
	} catch (error) {
		console.log(error);
	}

	let latestOrders = [];
	try {
		latestOrders = await orderService.getOrdersWithSort(req.auth.userDetails._id);
	} catch (error) {
		console.log(error);
	}

	res.render("overview", {
		layout: "dashboard",
		pagename: "overview",
		userDetails: req.auth.userDetails,
		topSellers: topSellers,
		latestOrders: latestOrders
	});
});

app.get("/dashboard/categories", (req, res) => {
	categoryService
		.getAllCategories(req.auth.userDetails)
		.then(category => {
			category.forEach(cat => {
				productService
					.productsWithCategory(req.auth.userDetails._id, cat.name)
					.then(count => {
						cat.count = count;
					})
					.catch(e => {
						res.json({ error: "unable to count products." });
					});
			});

			res.render("categories", {
				layout: "dashboard",
				pagename: "categories",
				categories: category,
				userDetails: req.auth.userDetails
			});
		})
		.catch(e => {
			res.json({ error: "unable to get all categories" });
		});
});

app.get("/dashboard/products", (req, res) => {
	categoryService
		.getAllCategories(req.auth.userDetails)
		.then(category => {
			productService
				.getAllProducts(req.auth.userDetails)
				.then(prods => {
					res.render("products", {
						layout: "dashboard",
						pagename: "products",
						products: prods,
						categories: category,
						userDetails: req.auth.userDetails
					});
				})
				.catch(e => {
					res.json({ error: "unable to get all products" });
				});
		})

		.catch(e => {
			res.json({ error: "unable to get all categories" });
		});
});

app.get("/getProductDetail/:id", (req, res) => {
	var id = req.params.id;
	var allProds = productService
		.getProductById(id)
		.then(prod => {
			res.json({ product: prod });
		})
		.catch(e => {
			res.json({ error: "Unable to get product" });
		});
});

app.get("/dashboard/settings/resendVerification", (req, res) => {
	mailService
		.sendVerificationEmail(req.auth.userDetails.email, "signup")
		.then(() => {
			res.redirect("/email-verification-sent");
		})
		.catch(err => {
			res.redirect("/404");
		});
});

app.get("/dashboard/orders", (req, res) => {
	var allorders = orderService
		.getAllOrders(req.auth.userDetails._id)
		.then(orders => {
			res.render("orders", {
				layout: "dashboard",
				pagename: "orders",
				orders: orders,
				userDetails: req.auth.userDetails
			});
		})
		.catch(e => {
			res.json({ error: "unable to get all orders" });
		});
});

app.get("/getOrderDetail/:id", (req, res) => {
	var id = req.params.id;
	var oneOrder = orderService
		.getOrderById(id)
		.then(prod => {
			res.json({ order: prod });
		})
		.catch(e => {
			res.json({ error: "Unable to get Order" });
		});
});

app.get("/dashboard/settings", (req, res) => {
	res.render("settings", {
		layout: "dashboard",
		pagename: "settings",
		userDetails: req.auth.userDetails,
		securityQuestions: userService.SecurityQuestions
	});
});

app.get("/dashboard/customize", (req, res) => {
	customizationService
		.get(req.auth.userDetails._id)
		.then(cust => {
			res.render("customize", {
				layout: "dashboard",
				pagename: "customize",
				userDetails: req.auth.userDetails,
				customizations: cust
			});
		})
		.catch(err => {
			res.send("server error: " + err);
		});
});

app.get("/dashboard/wizard/one", (req, res) => {
	res.render("wizardSteps/one", {
		layout: "wizard"
	});
});

app.get("/dashboard/wizard/two", async (req, res) => {
	if (req.query.name) {
		try {
			await userService.directEdit({ _id: req.auth.userDetails._id, businessName: req.query.name });
		} catch (error) {
			res.send("Error: " + error);
		}
	}

	industryModel.find({}, {}, { lean: true }, (err, industries) => {
		res.render("wizardSteps/two", {
			layout: "wizard",
			wizardCommon: {
				industries: industries
			}
		});
	});
});

app.get("/dashboard/wizard/four", (req, res) => {
	res.render("wizardSteps/four", { layout: "wizard" });
});

app.get("/dashboard/wizard/three", async (req, res) => {
	try {
		await userService.directEdit({ _id: req.auth.userDetails._id, industry_id: req.query.industry });
	} catch (error) {
		res.send("Error: " + error);
	}

	userService.getUserDataForSession(req.auth.userDetails._id).then(result => {
		req.auth.userDetails = result;
		res.render("wizardSteps/three", {
			layout: "wizard"
		});
	});
});

app.get("/dashboard/wizard/final", async (req, res) => {
	await userService.directEdit({ _id: req.auth.userDetails._id, didCompleteWizard: true });

	res.render("wizardSteps/final", {
		layout: "wizard"
	});
});

app.get("/dashboard/wizard", (req, res) => {
	industryModel.find({}, {}, { lean: true }, (err, industries) => {
		res.render("wizardSteps/start", {
			layout: "wizard",
			wizardCommon: {
				industries: industries
			}
		});
	});
});

app.get("/dashboard/:route", (req, res) => {
	const route = req.params.route;
	res.render(
		route,
		{
			layout: "dashboard",
			pagename: route,
			userDetails: req.auth.userDetails
		},
		(error, html) => {
			if (error) {
				res.redirect("/404");
			} else {
				res.send(html);
			}
		}
	);
});
app.get("/deleteProduct/:id", (req, res) => {
	let id = req.params.id;
	productService
		.deleteProduct(id)
		.then(() => {
			res.json({ error: false, redirectUrl: "/dashboard/products" });
		})
		.catch(err => {
			res.json({ error: err });
		});
});

app.get("/logout", (req, res) => {
	req.auth.isLoggedIn = false;
	req.auth.userDetails = {};
	res.render("loggedOut", { layout: "NavBar" });
});

/* 

Website routes keyword: k.web k.site

*/
app.get("/addToCart/:id", (req, res) => {
	var productId = req.params.id;
	var cart = new Cart(req.shoppingCart.cart ? req.shoppingCart.cart : {});
	productService.getProductById(productId).then((prod, err) => {
		if (err) {
			console.log(err);
			return res.redirect("*");
		} else {
			if (cart.checkQty(prod, productId, 1)) {
				cart.add(prod, productId);
				req.shoppingCart.cart = cart;
				res.json({ success: true });
			} else {
				res.json({ success: false });
			}
		}
	});
});
app.post("/addToCart/:id", (req, res) => {
	var productId = req.params.id;
	var qty = req.body.number;

	var cart = new Cart(req.shoppingCart.cart ? req.shoppingCart.cart : {});
	productService.getProductById(productId).then((prod, err) => {
		if (err) {
			console.log(err);
			return res.redirect("*");
		} else {
			if (cart.checkQty(prod, productId, qty)) {
				cart.addMore(prod, productId, qty);
				req.shoppingCart.cart = cart;
				res.json({ success: true });
			} else {
				res.json({ success: false });
			}
		}
	});
});

app.get("/removeFromCart/:id", (req, res) => {
	var productId = req.params.id;

	var cart = new Cart(req.shoppingCart.cart ? req.shoppingCart.cart : {});

	productService.getProductById(productId).then((prod, err) => {
		if (err) {
			console.log(err);
			return res.redirect("*");
		} else {
			cart.remove(prod, productId);
			req.shoppingCart.cart = cart;
			res.redirect("back");
		}
	});
});

app.get("/clearCart", (req, res) => {
	var cart = new Cart(req.shoppingCart.cart ? req.shoppingCart.cart : {});

	cart.clear();
	req.shoppingCart.cart = cart;
	res.redirect("back");
});

app.get("/salesByCategory", (req, res) => {
	productService
		.getTopCategories(req.auth.userDetails._id)
		.then(counts => {
			res.json(counts);
		})
		.catch(err => {
			res.json({ error: err });
		});
});

app.get("/sites/:id", (req, res) => {
	let id = req.params.id;
	if (!req.shoppingCart.cart) {
		req.shoppingCart.cart = {};
	}
	userService
		.getWebsiteDataById(id)
		.then(site => {
			productService.getAllProducts(id).then(prods => {
				site.baseUrl = "/sites/" + site._id;
				res.render("siteViews/home", {
					layout: __dirname + "/views/siteViews/layouts/nav",
					siteData: site,
					prods: prods,
					cart: req.shoppingCart.cart
				});
			});
		})
		.catch(err => {
			res.redirect("/404");
		});
});

app.get("/sites/:id/shoppingCart", (req, res) => {
	if (!req.shoppingCart.cart) {
		req.shoppingCart.cart = {};
	}
	let id = req.params.id;
	let shoppingCart = req.shoppingCart.cart;
	userService
		.getWebsiteDataById(id)
		.then(site => {
			site.baseUrl = "/sites/" + site._id;

			if (!req.shoppingCart.cart) {
				res.render("siteViews/shoppingCart", {
					layout: __dirname + "/views/siteViews/layouts/nav",
					siteData: site,
					cart: shoppingCart
				});
			}
			var cart = new Cart(req.shoppingCart.cart);
			res.render("siteViews/shoppingCart", {
				layout: __dirname + "/views/siteViews/layouts/nav",
				cart: shoppingCart,
				siteData: site,
				products: cart.generateArray(),
				totalPrice: cart.totalPrice,
				totalQty: cart.totalQty
			});
		})
		.catch(err => {
			res.redirect("/404");
		});
});

app.get("/sites/:id/shoppingCart/checkout", (req, res) => {
	if (!req.shoppingCart.cart) {
		return res.render("siteViews/shoppingCart", {
			layout: __dirname + "/views/siteViews/layouts/nav",
			siteData: site,
			cart: shoppingCart
		});
	}
	let id = req.params.id;
	let shoppingCart = req.shoppingCart.cart;
	userService
		.getWebsiteDataById(id)
		.then(site => {
			site.baseUrl = "/sites/" + site._id;

			if (!req.shoppingCart.cart) {
				res.render("siteViews/checkout", {
					layout: __dirname + "/views/siteViews/layouts/nav",
					siteData: site,
					cart: shoppingCart
				});
			}
			var cart = new Cart(req.shoppingCart.cart);
			var errMsg = "Something went wrong with credit card validation";
			res.render("siteViews/checkout", {
				layout: __dirname + "/views/siteViews/layouts/nav",
				cart: shoppingCart,
				siteData: site,
				products: cart.generateArray(),
				totalPrice: cart.totalPrice,
				totalQty: cart.totalQty,
				errMsg: errMsg
			});
		})
		.catch(err => {
			res.redirect("/404");
		});
});

app.get("/sites/:id/:route", (req, res) => {
	let id = req.params.id;
	let shoppingCart = req.shoppingCart.cart;
	const route = req.params.route;

	userService
		.getWebsiteDataById(id)
		.then(site => {
			productService.getAllProducts(id).then(prods => {
				site.baseUrl = "/sites/" + site._id;
				res.render("siteViews/" + route, {
					layout: __dirname + "/views/siteViews/layouts/nav",
					siteData: site,
					prods: prods,
					cart: shoppingCart
				});
			});
		})
		.catch(err => {
			res.redirect("/404");
		});
});

/* 





	ROUTES k.post 
		->	POST 	Place all POST routes here





*/

app.post("/sites/:id/shoppingCart/checkout", async (req, res) => {
	var productList = req.shoppingCart.cart.items;
	var validate = true; //validate credit card
	//reference to ownerID of website
	var shopID = req.params.id;
	var siteData = await userService.getWebsiteDataById(shopID);
	let infoToPass = req.body;

	var parsedProductList = [];
	if (validate) {
		for (let [key, value] of Object.entries(productList)) {
			var productEntry = { ProductID: key, ProductName: value.name, Qty: value.qty };
			parsedProductList.push(productEntry);
		}

		infoToPass.productList = parsedProductList;
		infoToPass.sellerId = req.params.id;
		infoToPass.subTotal = req.shoppingCart.cart.totalPrice;
		infoToPass.total = (req.shoppingCart.cart.totalPrice + 5).toFixed(2);
		var stripe = require("stripe")("sk_test_28qAisNXpS3GeDEIcJ5J4Mst009xCAs61e");

		stripe.charges.create(
			{
				amount: infoToPass.total * 100,
				currency: "cad",
				source: req.body.stripeToken,
				description: "Charge from eEz Business ID: " + shopID
			},
			function(err, charge) {
				if (err) {
					console.log(err.message);
				} else {
					console.log("Successfully bought product!");
					req.cart = null;
				}
			}
		);

		try {
			let order = await orderService.addOrder(infoToPass);
			await mailService.sendReceipt(req.body.email, order);
			res.render("siteViews/thanks", {
				layout: false,
				order: JSON.parse(JSON.stringify(order)),
				siteData: siteData
			});
		} catch (error) {
			console.log(error);
			res.json({ error: error });
		}
	}
});

app.post("/signup", (req, res) => {
	userService
		.create({ email: req.body.email, password: req.body.inputPassword })
		.then(() => {
			if (process.env.BYPASS_VERIFICATION === "true") {
				res.json({ error: "**SIGNED UP WITH BYPASSED VERIFICATION**" });
				console.log("\n\n\t**DANGER: SIGNED UP WITH BYPASSED VERIFICATION CHECK ENV.BYPASS_VERIFICATION**\n\n");
			} else {
				mailService
					.sendVerificationEmail(req.body.email, "signup")
					.then(() => {
						res.json({ error: false, redirectUrl: "/email-verification-sent" });
						//res.send("signup success, redirecting <script>setTimeout(()=>{window.location = '/'}, 2000)</script>");
					})
					.catch(e => {
						res.json({ error: "Error sending verification email. Please try again later." });

						userService.delete(req.body.email).catch(err => {
							console.log(err);
						});
						if (e.toString().indexOf("Greeting") >= 0) {
							console.log(e + "\n\n\n ***CHECK YOUR FIREWALL FOR PORT 587***");
						}
					});
			}
		})
		.catch(error => {
			console.log(error);

			switch (error.code) {
				case 11000:
					res.json({ error: "Email already exists. Please login or check your email address for accuracy." });
					break;

				default:
					res.json({ error: "Unspecified error occurred. Please try again later." });
					console.log(error);
					break;
			}
		});
});

app.post("/resetPassword", function(req, res) {
	const email = req.body.email;

	userService.findMatchingEmail(email).then(function(user) {
		if (user) {
			mailService
				.sendVerificationEmail(req.body.email, "reset")
				.then(() => {
					res.json({ error: false, redirectUrl: "/email-reset-sent" });
				})
				.catch(e => {
					console.log(e);
					res.redirect("*");

					if (e.toString().indexOf("Greeting") >= 0) {
						console.log(e + "\n\n\n ***CHECK YOUR FIREWALL FOR PORT 587***");
					}
				});
		} else {
			res.json({ error: "User not found in our database.", redirectUrl: "/forgot" });
		}
	});
});

app.post("/resetPassword/change", (req, res) => {
	if (req.body.newPassword === req.body.newConfirmPassword) {
		userService
			.changePasswordWithToken(req.body.email, req.body.token, req.body.newPassword)
			.then(result => {
				res.json({ redirectUrl: "/" });
			})
			.catch(err => [res.json({ error: err })]);
	} else {
		res.json({ error: "Passwords don't match" });
	}
});

app.post("/changePassword", (req, res) => {
	if (req.body.newPassword === req.body.newConfirmPassword) {
		userService
			.changePassword(req.auth.userDetails._id, req.body.originalPassword, req.body.newPassword)
			.then(result => {
				res.json({ error: false, redirectUrl: "/dashboard/settings" });
			})
			.catch(err => {
				res.json({ error: err });
			});
	} else {
		res.json({ error: "Passwords don't match" });
	}
});

app.post("/login", (req, res) => {
	userService
		.authenticate(req.body.email, req.body.password)
		.then(user => {
			req.auth.isLoggedIn = true;
			req.auth.userDetails = user;
			if (user.didCompleteWizard) {
				res.json({ error: false, redirectUrl: "/dashboard" });
			} else {
				res.json({ error: false, redirectUrl: "/dashboard/wizard" });
			}
		})
		.catch(err => {
			res.json({ error: err });
		});
});
app.post("/addCategory", (req, res) => {
	let categoryName = req.body.categoryName;
	let ownerId = req.auth.userDetails._id;
	if (req.auth.isLoggedIn) {
		categoryService
			.addCategory(ownerId, categoryName)
			.then(() => {
				res.json({ error: false, redirectUrl: "/dashboard/categories" });
			})
			.catch(err => {
				console.log(err);
				res.json({ error: err });
			});
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

app.post("/addProduct", uploadImg.single("imgFile"), (req, res) => {
	let file = req.file;
	let prodName = req.body.productName;
	let prodDesc = req.body.productDesc;
	let prodQty = req.body.productInventory;
	let prodPrice = req.body.productPrice;
	let prodSKU = req.body.productSKU;
	let prodCat = req.body.productCategory;
	let ownerId = req.auth.userDetails._id;
	let prodPath = file.destination + prodSKU + path.extname(file.originalname);
	if (req.auth.isLoggedIn) {
		if (req.file == undefined) {
			console.log("file undefined");
		} else {
			fs.rename(
				file.destination + file.filename,
				file.destination + prodSKU + path.extname(file.originalname),
				function(err) {
					if (err) throw err;
				}
			);
		}
		productService
			.addProduct(ownerId, prodSKU, prodName, prodQty, prodPrice, prodDesc, prodCat, prodPath.substring(6))
			.then(() => {
				res.json({ error: false, redirectUrl: "/dashboard/products" });
			})
			.catch(err => {
				switch (err.code) {
					case 11000:
						res.json({ error: "SKU already exists!" });
						break;

					default:
						res.json({ error: err });
						break;
				}
			});
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

app.post("/editProduct/:id", uploadImg.single("newImg"), (req, res) => {
	let prodId = req.params.id;
	let prodDesc = req.body.descDetail;
	let prodQty = req.body.qtyDetail;
	let prodPrice = req.body.priceDetail;
	let prodSold = req.body.soldDetail;
	let prodSKU = req.body.skuDetail;
	let file = req.file;

	if (req.file) {
		productService.getProductById(prodId).then(prod => {
			fs.renameSync(
				file.destination + file.filename,
				file.destination + prod.SKU + path.extname(file.originalname),
				function(err) {
					if (err) throw err;
				}
			);
		});
	}

	if (req.auth.isLoggedIn) {
		productService
			.editProduct(prodId, prodQty, prodPrice, prodDesc, prodSold)
			.then(() => {
				res.json({ error: false, redirectUrl: "/dashboard/products" });
			})
			.catch(err => {
				console.log(err);
				res.json({ error: err });
			});
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

app.post("/editOrder/:id", (req, res) => {
	let OrdId = req.params.id;
	let newStatus = req.body.odStatus;

	if (req.auth.isLoggedIn) {
		orderService
			.editOrder(OrdId, newStatus)
			.then(() => {
				res.json({ error: false, redirectUrl: "/dashboard/orders" });
			})
			.catch(err => {
				console.log(err);
				res.json({ error: err });
			});
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});
app.post("/addOrder", (req, res) => {
	let newSID = req.auth.userDetails._id;
	let newAdd = req.body.Address;
	let newCC = req.body.CreditC;
	let newStatus = req.body.oStatus;
	let newTotal = req.body.oTotal;
	orderService
		.addOrder(newSID, newAdd, newCC, newStatus, newTotal)
		.then(() => {
			res.json({ error: false, redirectUrl: "/dashboard/orders" });
		})
		.catch(err => {
			res.json({ error: err });
		});
});

// keywords k.edit
app.post("/edit-user", (req, res) => {
	if (req.auth.isLoggedIn) {
		let passed = req.body;

		if (passed.questionOne === passed.questionTwo) {
			res.json({ error: "Security questions must be unique." });
			return;
		}

		passed._id = req.auth.userDetails._id;
		passed.isVerified = req.auth.userDetails.email === passed.email ? req.auth.userDetails.isVerified : false;

		userService
			.edit(passed)
			.then(result => {
				userService
					.getUserDataForSession(req.auth.userDetails._id)
					.then(user => {
						req.auth.userDetails = user;
						res.json({ redirectUrl: "/dashboard/settings" });
					})
					.catch(err => {
						res.json({ error: err });
					});
			})
			.catch(err => {
				res.json({ error: err });
			});
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

// k.customize
app.post("/customize", uploadFeatureImage.single("feature"), async (req, res) => {
	if (req.auth.isLoggedIn) {
		if (req.hadFile && req.imgError == undefined) {
			await jimp
				.read(`${__dirname}/public/siteData/${req.auth.userDetails._id}/img/feature/feature`)
				.then(img => {
					img
						.resize(1920, jimp.AUTO)
						.quality(60)
						.write(`${__dirname}/public/siteData/${req.auth.userDetails._id}/img/feature/feature.jpg`);

					req.body.hasFeatureImage = true;
				})
				.catch(err => {
					req.body.hasFeatureImage = false;
					console.log(err);
				});
		}

		if (req.imgError) {
			res.json({ error: req.imgError });
			return;
		}

		try {
			await customizationService.edit(req.auth.userDetails._id, req.body);
			res.json({ redirectUrl: "/dashboard/customize" });
		} catch (error) {
			console.log(error);

			res.json({ error: error });
		}
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

app.post("/uploadAvatar", uploadAvatar.single("avatarImg"), async (req, res) => {
	if (req.auth.isLoggedIn) {
		jimp
			.read(`${__dirname}/public/siteData/${req.auth.userDetails._id}/img/avatar/avatar`)
			.then(avatar => {
				avatar
					.resize(jimp.AUTO, 500)
					.write(`${__dirname}/public/siteData/${req.auth.userDetails._id}/img/avatar/avatar.png`);
				res.redirect("dashboard");
			})
			.catch(err => {
				console.log(err);
				res.redirect("dashboard");
			});
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

app.post("/about_blurb", (req, res) => {
	if (req.auth.isLoggedIn) {
		userService
			.directEdit({
				_id: req.auth.userDetails._id,
				aboutBlurb: req.body.about
			})
			.then(result => {
				req.auth.userDetails.aboutBlurb = req.body.about;
				res.json({ success: true });
			})
			.catch(err => {
				console.log(err);
				res.json({ error: err });
			});
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

/*




	other




*/
app.get("*", (req, res) => {
	res.status(404);
	res.render("ErrorPage", { layout: "NavBar" });
});

if (process.env.ENABLE_SSL === "true") {
	try {
		var httpsOptions = {
			key: fs.readFileSync(__dirname + "/cert/prj666-2021.key"),
			cert: fs.readFileSync(__dirname + "/cert/prj666-2021.crt"),
			ca: [fs.readFileSync(__dirname + "/cert/RapidSSL_RSA_CA_2018.crt")]
		};
		var srv = require("https")
			.createServer(httpsOptions, app)
			.listen(443);
		console.log("https server listening on port 443");
	} catch (error) {
		console.error(error + "\n\n****\tWARNING: SSL IS NOT CONFIGURED\t****");
	}
}

// start listening
app.listen(process.env.SERVER_PORT || 8080, process.env.SERVER_HOSTNAME, () => {
	console.log("http server listening on port " + process.env.SERVER_PORT || 8080);
});
