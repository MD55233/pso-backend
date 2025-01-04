import {
    Body,
    Button,
    Container,
    Column,
    Head,
    Heading,
    Html,
    Img,
    Preview,
    Row,
    Section,
    Text,
  } from "@react-email/components";
  import * as React from "react";
  
  interface LaikoStarWelcomeEmailProps {
    userFirstName: string;
    username: string;
    password: string;
    referralCode?: string;
  }
  
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";
  
  export const LaikoStarWelcomeEmail = ({
    userFirstName,
    username,
    password,
    referralCode,
  }: LaikoStarWelcomeEmailProps) => {
    return (
      <Html>
        <Head />
        <Preview>Welcome to LaikoStar! Here are your login credentials.</Preview>
        <Body style={main}>
          <Container>
            <Section style={logo}>
              <Img src={`${baseUrl}/static/yelp-logo.png`} alt="LaikoStar Logo" />
            </Section>
  
            <Section style={content}>
              <Row>
                <Img
                  style={image}
                  width={620}
                  src={`${baseUrl}/static/yelp-header.png`}
                  alt="Welcome Banner"
                />
              </Row>
  
              <Row style={boxInfos}>
                <Column>
                  <Heading style={heading}>
                    Welcome, {userFirstName}!
                  </Heading>
                  <Text style={paragraph}>
                    We're thrilled to have you join the LaikoStar community, where opportunities await!
                  </Text>
  
                  <Text style={paragraph}>
                    Here are your login details:
                  </Text>
                  <Text style={paragraph}>
                    <b>Username:</b> {username}
                  </Text>
                  <Text style={paragraph}>
                    <b>Password:</b> {password}
                  </Text>
  
                  {referralCode && (
                    <Text style={paragraph}>
                      <b>Referral Code:</b> {referralCode}
                    </Text>
                  )}
  
                  <Text style={paragraph}>
                    Use these credentials to log in to your account and start exploring the benefits of LaikoStar.
                  </Text>
                </Column>
              </Row>
              <Row style={containerButton}>
                <Button style={button} href="https://laikostar.com/">
                  Log In Now
                </Button>
              </Row>
            </Section>
  
            <Section style={containerImageFooter}>
              <Img
                style={image}
                width={620}
                src={`${baseUrl}/static/yelp-footer.png`}
                alt="Footer Banner"
              />
            </Section>
  
            <Text style={footerText}>
              © 2025 LaikoStar Inc., Empowering Opportunities | laikostar.com
            </Text>
          </Container>
        </Body>
      </Html>
    );
  };
  
  const main = {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, sans-serif",
  };
  
  const paragraph = {
    fontSize: 16,
    color: "#333",
  };
  
  const heading = {
    fontSize: 24,
    fontWeight: "bold",
  };
  
  const logo = {
    padding: "20px 0",
    textAlign: "center",
  };
  
  const content = {
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "20px",
  };
  
  const containerButton = {
    textAlign: "center",
    margin: "20px 0",
  };
  
  const button = {
    backgroundColor: "#f7931e",
    color: "#fff",
    borderRadius: "5px",
    padding: "10px 20px",
    border: "none",
    textDecoration: "none",
    cursor: "pointer",
  };
  
  const image = {
    maxWidth: "100%",
  };
  
  const boxInfos = {
    padding: "20px",
  };
  
  const containerImageFooter = {
    padding: "20px 0",
  };
  
  const footerText = {
    fontSize: "12px",
    color: "#777",
    textAlign: "center",
    marginTop: "20px",
  };
  