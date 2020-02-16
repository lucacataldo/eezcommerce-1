require("dotenv").config();

// dependencies
const express = require("express");
var app = express();
var sessions = require("client-sessions");
var fs = require("fs");
var bodyParser = require("body-parser");
var exphbs = require("express-handlebars");
var sass = require("sass");

// custom modules
const mailService = require("./modules/emailService.js");
const userService = require("./modules/userService.js");
const productService = require("./modules/productService.js");
const orderService = require("./modules/orderService");
const hbHelpers = require("./modules/hbHelpers.js");

// express middlewares & setup

// Sets the express view engine to use handlebars (file endings in .hbs), registers helpers
app.engine(
	".hbs",
	exphbs({
		extname: ".hbs",
		helpers: {
			activeLink: hbHelpers.activeLink
		}
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
		next();
	} else {
		res.status(403).send("403 Unauthorized <a href='/'>home</a>");
	}
});

// ROUTES keyword: k.get
// 		->	GET 	Place all GET routes here

app.get("/", (req, res) => {
	res.render("home", { layout: "NavBar", pagename: "home" });
	//res.render("home"); //Change to this when HBS is implemented
});

app.get("/forgot", (req, res) => {
	res.render("ForgottenPassword", { layout: "NavBar" });
});
app.get("/verify_email/:email/:token", (req, res) => {
	let token = req.params.token;
	let email = req.params.email;

	userService
		.validateToken(token, email)
		.then(() => {
			req.auth.userDetails.isVerified = true;
			res.render("EmailVerified", { layout: "NavBar" });
		})
		.catch(error => {
			res.json(error);
		});
});

app.get("/about_me", (req, res) => {
	if (req.auth.isLoggedIn) {
		res.json(req.auth);
	} else {
		res.sendStatus(403);
	}
});

app.get("/testimonials", (req, res) => {
	res.render("testimonials", { layout: "Navbar" });
});

app.get("/email-reset-sent", (req, res) => {
	res.render("EmailResetSent", { layout: "NavBar" });
});

app.get("/email-verification-sent", (req, res) => {
	res.render("EmailVerificationSent", { layout: "NavBar" });
});

// Dashboard routes keywords k.dash

app.get("/dashboard", (req, res) => {
	res.render("overview", { layout: "dashboard", pagename: "overview", userDetails: req.auth.userDetails });
});

app.get("/dashboard/products", (req, res) => {
	var allProds = productService
		.getAllProducts(req.auth.userDetails)
		.then(prods => {
			res.render("products", {
				layout: "dashboard",
				pagename: "products",
				products: prods,
				userDetails: req.auth.userDetails
			});
		})
		.catch(e => {
			res.json({ error: "unable to get all products" });
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

app.get("/dashboard/orders", (req, res) => {
	var allorders = orderService.getAllOrders(req.auth.userDetails._id)
		.then(prods => {
			res.render("orders", {
				layout: "dashboard",
				pagename: "orders",
				orders: prods,
				userDetails: req.auth.userDetails
			});
		})
		.catch(e => {
			res.json({ error: "unable to get all orders" });
		});
});


app.get("/getOrderDetail/:id", (req, res) => {
	var id = req.params.id;
	var oneOrder = orderService.getOrderById(id)
		.then(prod => {
			res.json({ order: prod });
		})
		.catch(e => {
			res.json({ error: "Unable to get product" });
		});
});

app.get("/dashboard/settings", (req, res) => {
	res.render("settings", { layout: "dashboard", pagename: "settings", userDetails: req.auth.userDetails });
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

// Website routes keyword: k.web k.site

app.get("/sites/:id", (req, res) => {
	let id = req.params.id;
	userService
		.getWebsiteDataById(id)
		.then(site => {
			productService.getAllProducts().then(prods => {
				site.customMessage = "hello";
				site.baseUrl = "/sites/" + site._id;
				res.render("siteViews/home", { layout: false, siteData: site, prods: prods });
			});
		})
		.catch(err => {
			res.redirect("/404");
		});
});

// ROUTES k.post
// 		->	POST 	Place all POST routes here

app.post("/signup", (req, res) => {
	userService
		.create({ email: req.body.email, password: req.body.inputPassword })
		.then(() => {
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
		})
		.catch(error => {
			userService.delete(req.body.email).catch(err => {
				console.log(err);
			});
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
					//res.send("signup success, redirecting <script>setTimeout(()=>{window.location = '/'}, 2000)</script>");
				})
				.catch(e => {
					console.log(e);
					res.redirect("*");

					if (e.toString().indexOf("Greeting") >= 0) {
						console.log(e + "\n\n\n ***CHECK YOUR FIREWALL FOR PORT 587***");
					}
				});
			//res.send("No User...<script>alert('user Email does not exist'); window.location = 'forgot'</script>");
		} else {
			res.json({ error: "User not found in our database.", redirectUrl: "forgot" });
		}
	});
});

app.post("/login", (req, res) => {
	userService
		.authenticate(req.body.email, req.body.password)
		.then(user => {
			req.auth.isLoggedIn = true;
			req.auth.userDetails = user;
			res.json({ error: false, redirectUrl: "/dashboard" });
		})
		.catch(err => {
			res.json({ error: err });
		});
});

app.post("/addProduct", (req, res) => {
	let prodName = req.body.productName;
	let prodDesc = req.body.productDesc;
	let prodQty = req.body.productInventory;
	let prodPrice = req.body.productPrice;
	let prodSKU = req.body.productSKU;
	let ownerId = req.auth.userDetails._id;

	productService.isDuplicate(ownerId, prodSKU).then(duplicate => {
		if (duplicate == "true") {
			res.json({ error: "SKU already exists!" });
		} else {
			productService
				.addProduct(ownerId, prodSKU, prodName, prodQty, prodPrice, prodDesc)
				.then(() => {
					res.json({ error: false, redirectUrl: "/dashboard/products" });
				})
				.catch(err => {
					console.log(err);
					res.json({ error: err });
				});
		}
	});
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

app.post("/edit-user", (req, res) => {
	if (req.auth.isLoggedIn) {
		let passed = req.body;
		passed._id = req.auth.userDetails._id;
		userService
			.edit(passed)
			.then(result => {
				req.auth.userDetails.businessName = passed.businessName;
				req.auth.userDetails.email = passed.email;
				res.json({ redirectUrl: "/dashboard/settings" });
			})
			.catch(err => {
				res.json({ error: err });
			});
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

app.post("/customize", (req, res) => {
	if (req.auth.isLoggedIn) {
		let customSass = sass.renderSync({
			data: `
				$theme-colors: (
					"primary": #${req.body.primaryColor},
					"secondary": #${req.body.secondaryColor}
				);

				@import "node_modules/bootstrap/scss/bootstrap";
			`
		});

		try {
			fs.writeFileSync(__dirname + "/public/siteData/" + req.auth.userDetails._id + "/theme.css", customSass.css);
			res.json({ redirectUrl: "/dashboard/customize" });
		} catch (err) {
			res.json({ error: err });
		}
	} else {
		res.json({ error: "Unauthorized. Please log in." });
	}
});

// Express MiddleWares

// fallback for unknown routes
app.get("*", (req, res) => {
	res.status(404);
	res.render("ErrorPage", { layout: "NavBar" });
});

if (process.env.ENABLE_SSL) {
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
