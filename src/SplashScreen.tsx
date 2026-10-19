import React, { useEffect } from "react";
import { View, Image, StyleSheet } from "react-native";

type Props = {
  navigation: any;
};

export default function SplashScreen({ navigation }: Props) {

  useEffect(() => {
    setTimeout(() => {
      navigation.replace("Login");
    }, 1600); //2000= 2 secondes
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/ic_launcher.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  logo: {
    width: 300,
    height: 500,
  },
});