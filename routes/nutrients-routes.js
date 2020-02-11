//Imports express npm
const express = require('express');

//calls the express.router method
const router = express.Router();

const db = require('../models');
const axios = require('axios');

//This route will return all the nutrients available in the nutrients table
router.get("/api/nutrientCodes", function (req, res) {

  db.Nutrients.findAll({}).then(function (dbNutrients) {

    console.log("inside get response");

    res.json(dbNutrients);
  });
});

router.post("/api/nutrients/:nutrients", function (req, res) {

  console.log("User has searched for " + req.params.nutrients);

  const queryURL = `https://api.edamam.com/search?q=chicken&app_id=08b4fa57&app_key=8531f8a5f6847b98f73396ab5968aed9&nutrients%5B${req.params.nutrients}%5D=20%2B`

  axios.get(queryURL).then(function (apiRecipes) {

    const recipesArr = apiRecipes.data.hits
    const ingredientsArr = recipesArr[0].recipe.ingredientLines

    const createArr = recipesArr.map(recipes => {
      const obj = {
        searchQuery: queryURL,
        recipeLabel: recipes.recipe.label,
        recipeUrl: recipes.recipe.url,
        recipeImg: recipes.recipe.image,
        recipeIngredients: ingredientsArr.toString(),
        recipeNutritionalData: JSON.stringify(recipes.recipe.digest)
      }
      return obj
    })


    db.Recipes.bulkCreate(createArr)
      .then(function () {
        // db.Recipes.findAll({ where: {searchQuery = queryURL} })
        res.render('recipes', { layout: false, recipe: recipesArr });
      })
      //   .catch(function(err) {
      //     res.status(401).json(err);
      //   });
      // console.log('in axios');
      // console.log(apiRecipes.data.hits);
      // const recipes = {
      //   layout: false,
      //   recipe: apiRecipes.data.hits
      // }
      // console.log('in axios2');

      // res.render('recipes', recipes, function(err, html) {
      //   if(err) {
      //     throw err
      //   } else {

      //   res.send(html);
      //   // console.log(html);
      //   }
      // });
      .catch(error => {
        console.error(error)
      })

  });

});

router.post("/api/recipes", function (req, res) {

})

module.exports = router;
